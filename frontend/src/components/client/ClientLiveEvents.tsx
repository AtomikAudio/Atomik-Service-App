import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef } from '@react-navigation/native';

import { bookingService, Booking } from '../../services/bookings';
import { reviewService } from '../../services/reviews';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import {
  emitBookingChanged,
  subscribeBookingChanged,
} from '../../services/liveUpdates';
import { navigateToBookingFromNotification } from '../../navigation/navigateFromNotification';
import {
  getClientSparePartsPayAmount,
  invoiceNeedsPayment,
  isExtraPartsOnlyPayment,
} from '../../utils/invoice';
import { sumSparePartsTotal } from '../../utils/sparePartsCalc';
import { formatINR } from '../../utils/payment';
import {
  hasRatedBooking,
  markBookingRated,
  markRatingSkipped,
  shouldPromptRating,
  shouldShowCompletionDialog,
} from '../../utils/ratingPrompt';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../common/ThemedConfirmModal';
import { RateTechnicianModal } from './RateTechnicianModal';

/**
 * Near-instant live updates for clients, without waiting on push delivery.
 *
 * Detects technician assigned / dropped / service completed / extra-parts-due
 * transitions and surfaces branded dialogs.
 *
 * Polls on an interval as a fallback (Expo Go has no remote push), and also
 * immediately when a foreground push / booking-changed signal arrives.
 */
const POLL_MS = 5000;
const RATE_LIMIT_BACKOFF_MS = 90000;
const SNAPSHOT_KEY = 'atomik_booking_snapshot_v2';
const COMPLETED_SEEN_KEY = 'atomik_completed_dialog_seen_v1';
const EXTRA_PARTS_SEEN_KEY = 'atomik_extra_parts_dialog_seen_v1';
const MAX_QUEUED_EVENTS = 8;

type Snapshot = Record<
  string,
  { t: string | null; s: string; pk: string }
>;

interface LiveEvent {
  bookingId: string;
  kind: 'assigned' | 'dropped' | 'completed' | 'rate' | 'extra_parts';
  techName?: string;
  service?: string;
  amountLabel?: string;
  /** Needed to open Payment with payFor=extra_parts */
  booking?: Booking;
}

interface Props {
  navigationRef: React.RefObject<NavigationContainerRef<
    Record<string, object | undefined>
  > | null>;
  enabled: boolean;
}

function formatService(service?: string): string {
  if (!service) return 'service';
  return service.replace(/[_-]+/g, ' ').trim() || 'service';
}

function partsFingerprint(b: Booking): string {
  const partsTotal = Math.round(sumSparePartsTotal(b.spareParts) * 100);
  const balance = Math.round((b.invoice?.balanceDue ?? 0) * 100);
  return `${partsTotal}:${balance}`;
}

function isExtraPartsDue(b: Booking): boolean {
  return (
    invoiceNeedsPayment(b.invoice) &&
    isExtraPartsOnlyPayment(b.invoice, b.spareParts)
  );
}

async function hasSeenCompletedDialog(bookingId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_SEEN_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) && ids.includes(bookingId);
  } catch {
    return false;
  }
}

async function markCompletedDialogSeen(bookingId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_SEEN_KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(ids)) {
      await AsyncStorage.setItem(COMPLETED_SEEN_KEY, JSON.stringify([bookingId]));
      return;
    }
    if (ids.includes(bookingId)) return;
    ids.push(bookingId);
    await AsyncStorage.setItem(
      COMPLETED_SEEN_KEY,
      JSON.stringify(ids.slice(-100))
    );
  } catch {
    // ignore
  }
}

async function hasSeenExtraPartsDialog(
  bookingId: string,
  fingerprint: string
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_PARTS_SEEN_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return map?.[bookingId] === fingerprint;
  } catch {
    return false;
  }
}

async function markExtraPartsDialogSeen(
  bookingId: string,
  fingerprint: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(EXTRA_PARTS_SEEN_KEY);
    const map: Record<string, string> = raw
      ? (JSON.parse(raw) as Record<string, string>)
      : {};
    map[bookingId] = fingerprint;
    const keys = Object.keys(map);
    if (keys.length > 80) {
      keys.slice(0, keys.length - 80).forEach((k) => {
        delete map[k];
      });
    }
    await AsyncStorage.setItem(EXTRA_PARTS_SEEN_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export const ClientLiveEvents: React.FC<Props> = ({ navigationRef, enabled }) => {
  const snapshotRef = useRef<Snapshot | null>(null);
  const queueRef = useRef<LiveEvent[]>([]);
  const busyRef = useRef(false);
  const pendingPollRef = useRef(false);
  const backoffUntilRef = useRef(0);
  const [current, setCurrent] = useState<LiveEvent | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);

  const showNext = useCallback(() => {
    setCurrent((cur) => (cur ? cur : queueRef.current.shift() ?? null));
  }, []);

  const enqueue = useCallback(
    (ev: LiveEvent) => {
      if (queueRef.current.length >= MAX_QUEUED_EVENTS) return;
      if (queueRef.current.some((q) => q.bookingId === ev.bookingId && q.kind === ev.kind)) {
        return;
      }
      if (current?.bookingId === ev.bookingId && current.kind === ev.kind) return;
      queueRef.current.push(ev);
      showNext();
    },
    [current, showNext]
  );

  const enqueueCompletedFlow = useCallback(
    async (b: Booking) => {
      const bookingId = b._id;
      const techName = b.technicianId?.name;
      const service = b.serviceType;

      if (
        shouldShowCompletionDialog(b) &&
        !(await hasSeenCompletedDialog(bookingId))
      ) {
        enqueue({
          bookingId,
          kind: 'completed',
          techName,
          service,
        });
      }
      if (await shouldPromptRating(bookingId, b)) {
        enqueue({
          bookingId,
          kind: 'rate',
          techName,
          service,
        });
      }
    },
    [enqueue]
  );

  const enqueueExtraPartsDue = useCallback(
    async (b: Booking) => {
      if (!isExtraPartsDue(b)) return;
      const fp = partsFingerprint(b);
      if (await hasSeenExtraPartsDialog(b._id, fp)) return;
      const amount = getClientSparePartsPayAmount(b.invoice, b.spareParts);
      enqueue({
        bookingId: b._id,
        kind: 'extra_parts',
        service: b.serviceType,
        amountLabel: formatINR(amount),
        booking: b,
      });
    },
    [enqueue]
  );

  const poll = useCallback(async () => {
    if (!enabled) return;
    if (Date.now() < backoffUntilRef.current) return;
    if (busyRef.current) {
      // A push/signal arrived mid-poll — run again once this finishes so we
      // don't miss a just-completed booking.
      pendingPollRef.current = true;
      return;
    }
    busyRef.current = true;
    pendingPollRef.current = false;
    try {
      const bookings = await bookingService.getMyBookings({ limit: 30 });
      const prev = snapshotRef.current;
      const next: Snapshot = {};
      let changed = false;

      for (const b of bookings) {
        const id = b._id;
        const techNow = resolveAssignedTechnicianId(b);
        const status = b.status;
        const pk = partsFingerprint(b);
        next[id] = { t: techNow, s: status, pk };

        const prevEntry = prev?.[id];
        if (prevEntry) {
          if (
            prevEntry.t !== techNow ||
            prevEntry.s !== status ||
            prevEntry.pk !== pk
          ) {
            changed = true;
          }
          const active = !['completed', 'cancelled'].includes(status);
          if (active && !prevEntry.t && techNow) {
            enqueue({
              bookingId: id,
              kind: 'assigned',
              techName: b.technicianId?.name,
              service: b.serviceType,
            });
          } else if (active && prevEntry.t && !techNow) {
            enqueue({ bookingId: id, kind: 'dropped', service: b.serviceType });
          } else if (
            prevEntry.s !== 'completed' &&
            status === 'completed' &&
            techNow
          ) {
            await enqueueCompletedFlow(b);
          }

          // Extra parts newly quoted / balance increased while base was already paid.
          const prevParts = Number(
            String(prevEntry.pk ?? '0:0').split(':')[0] || 0
          );
          const nowParts = Math.round(sumSparePartsTotal(b.spareParts) * 100);
          if (isExtraPartsDue(b) && nowParts > prevParts) {
            await enqueueExtraPartsDue(b);
          } else if (
            isExtraPartsDue(b) &&
            (prevEntry.pk ?? '0:0') !== pk &&
            (b.invoice?.balanceDue ?? 0) > 0
          ) {
            await enqueueExtraPartsDue(b);
          }
        } else if (prev) {
          changed = true;
          if (status === 'completed' && techNow) {
            await enqueueCompletedFlow(b);
          }
          if (isExtraPartsDue(b)) {
            await enqueueExtraPartsDue(b);
          }
        }
      }

      if (prev) {
        for (const id of Object.keys(prev)) {
          if (!next[id]) {
            changed = true;
            // Dropped out of the list — may have just completed. Confirm so the
            // client still gets the service-completed dialog on Home.
            if (prev[id].s !== 'completed') {
              try {
                const b = await bookingService.getBookingById(id);
                if (b.status === 'completed') {
                  const techNow = resolveAssignedTechnicianId(b);
                  next[id] = {
                    t: techNow,
                    s: b.status,
                    pk: partsFingerprint(b),
                  };
                  if (techNow) {
                    await enqueueCompletedFlow(b);
                  }
                }
              } catch {
                // ignore — booking may be gone / unauthorized
              }
            }
          }
        }
      }

      snapshotRef.current = next;
      void AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next)).catch(
        () => {}
      );

      if (changed) emitBookingChanged();
    } catch (err: any) {
      if (err?.status === 429) {
        backoffUntilRef.current = Date.now() + RATE_LIMIT_BACKOFF_MS;
      }
    } finally {
      busyRef.current = false;
      if (pendingPollRef.current) {
        pendingPollRef.current = false;
        setTimeout(() => {
          void poll();
        }, 0);
      }
    }
  }, [enabled, enqueue, enqueueCompletedFlow, enqueueExtraPartsDue]);

  useEffect(() => {
    if (!enabled) {
      snapshotRef.current = null;
      queueRef.current = [];
      setCurrent(null);
      return undefined;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (interval) return;
      interval = setInterval(() => void poll(), POLL_MS);
    };
    const stopInterval = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
        if (!cancelled && raw) snapshotRef.current = JSON.parse(raw) as Snapshot;
      } catch {
        // ignore corrupt cache
      }
      if (cancelled) return;
      void poll();
      startInterval();
    })();

    // Foreground push / other live signals → poll now so completion dialogs
    // appear without waiting for the interval or leaving Home.
    const unsubscribeLive = subscribeBookingChanged(() => {
      void poll();
    });

    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          void poll();
          startInterval();
        } else {
          stopInterval();
        }
      }
    );

    return () => {
      cancelled = true;
      stopInterval();
      unsubscribeLive();
      appStateSub.remove();
    };
  }, [enabled, poll]);

  const handleClose = useCallback(() => {
    setCurrent(null);
    setTimeout(showNext, 250);
  }, [showNext]);

  const handleCompletedClose = useCallback(() => {
    const ev = current;
    if (ev?.kind === 'completed') {
      void markCompletedDialogSeen(ev.bookingId);
      void bookingService.acknowledgeCompletion(ev.bookingId).catch(() => {});
    }
    handleClose();
  }, [current, handleClose]);

  const handleRateDismiss = useCallback(async () => {
    const ev = current;
    if (ev?.kind === 'rate' && !(await hasRatedBooking(ev.bookingId))) {
      await markRatingSkipped(ev.bookingId);
      void bookingService.dismissRatingPrompt(ev.bookingId).catch(() => {});
    }
    handleClose();
  }, [current, handleClose]);

  const handleSubmitRating = useCallback(
    async (rating: number) => {
      if (!current || current.kind !== 'rate') return;
      setRatingLoading(true);
      try {
        if (await hasRatedBooking(current.bookingId)) {
          return;
        }
        const existing = await reviewService.getForBooking(current.bookingId);
        if (existing.reviewed) {
          await markBookingRated(current.bookingId);
          return;
        }
        await reviewService.submit(current.bookingId, rating);
        await markBookingRated(current.bookingId);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Could not submit rating';
        Alert.alert('Rating failed', msg);
        throw e;
      } finally {
        setRatingLoading(false);
      }
    },
    [current]
  );

  const handleExtraPartsOkay = useCallback(() => {
    const ev = current;
    if (ev?.kind === 'extra_parts' && ev.booking) {
      void markExtraPartsDialogSeen(ev.bookingId, partsFingerprint(ev.booking));
    }
    // Refresh home/upcoming so the PAID badge flips to Unpaid / PAY EXTRA.
    emitBookingChanged(ev?.bookingId);
    handleClose();
  }, [current, handleClose]);

  const handleExtraPartsPayNow = useCallback(() => {
    const ev = current;
    if (ev?.kind === 'extra_parts' && ev.booking) {
      void markExtraPartsDialogSeen(ev.bookingId, partsFingerprint(ev.booking));
    }
    setCurrent(null);
    const nav = navigationRef.current;
    const booking = ev?.booking;
    const invoiceId = booking?.invoice?._id;
    if (nav && booking && invoiceId) {
      nav.navigate(
        'Client' as never,
        {
          screen: 'ClientTabs',
          params: {
            screen: 'Home',
            params: {
              screen: 'Payment',
              params: {
                bookingId: booking._id,
                invoiceId,
                serviceType: booking.serviceType,
                date: booking.scheduledDate,
                time: booking.scheduledTime,
                payFor: 'extra_parts' as const,
              },
            },
          },
        } as never
      );
    } else if (nav && ev) {
      navigateToBookingFromNotification(
        {
          dispatch: nav.dispatch.bind(nav),
          navigate: nav.navigate.bind(nav) as (...args: any[]) => void,
        },
        'client',
        ev.bookingId,
        { fromRoot: true }
      );
    }
    emitBookingChanged(ev?.bookingId);
    setTimeout(showNext, 400);
  }, [current, navigationRef, showNext]);

  const handleViewMore = useCallback(() => {
    const ev = current;
    setCurrent(null);
    const nav = navigationRef.current;
    if (nav && ev) {
      navigateToBookingFromNotification(
        {
          dispatch: nav.dispatch.bind(nav),
          navigate: nav.navigate.bind(nav) as (...args: any[]) => void,
        },
        'client',
        ev.bookingId,
        { fromRoot: true }
      );
    }
    setTimeout(showNext, 400);
  }, [current, navigationRef, showNext]);

  if (!current) return null;

  if (current.kind === 'rate') {
    return (
      <RateTechnicianModal
        visible
        technicianName={current.techName || 'your technician'}
        loading={ratingLoading}
        onSubmit={handleSubmitRating}
        onDismiss={() => {
          void handleRateDismiss();
        }}
      />
    );
  }

  if (current.kind === 'completed') {
    const service = formatService(current.service);
    const tech = current.techName?.trim() || 'Your technician';
    return (
      <ThemedAlertModal
        visible
        title="Service completed"
        message={`${tech} has completed your ${service} booking. Thank you for choosing ATOMIK.`}
        buttonLabel="OKAY"
        icon="checkmark-circle-outline"
        onClose={handleCompletedClose}
      />
    );
  }

  if (current.kind === 'extra_parts') {
    const service = formatService(current.service);
    const amount = current.amountLabel || 'the balance';
    return (
      <ThemedConfirmModal
        visible
        title="Extra parts payment due"
        message={`Chargeable parts were added to your ${service} booking. Amount due: ${amount}. Pay now to settle, or continue and pay from your booking.`}
        confirmLabel="PAY NOW"
        cancelLabel="OKAY"
        icon="card-outline"
        onConfirm={handleExtraPartsPayNow}
        onCancel={handleExtraPartsOkay}
      />
    );
  }

  const assigned = current.kind === 'assigned';
  const service = formatService(current.service);

  return (
    <ThemedConfirmModal
      visible={!!current}
      title={assigned ? 'Technician assigned' : 'Technician unavailable'}
      message={
        assigned
          ? `${current.techName || 'A technician'} has been assigned to your ${service} booking. You can view their details and track your service.`
          : `Your technician for the ${service} booking is no longer available. We're assigning a new one — you can view the latest status.`
      }
      confirmLabel="VIEW MORE"
      cancelLabel="OKAY"
      icon={assigned ? 'person-circle-outline' : 'alert-circle-outline'}
      onConfirm={handleViewMore}
      onCancel={handleClose}
    />
  );
};
