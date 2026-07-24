import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef } from '@react-navigation/native';

import { bookingService } from '../../services/bookings';
import { reviewService } from '../../services/reviews';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import { emitBookingChanged } from '../../services/liveUpdates';
import { navigateToBookingFromNotification } from '../../navigation/navigateFromNotification';
import {
  hasRatedBooking,
  markBookingRated,
  markRatingSkipped,
  shouldPromptRating,
} from '../../utils/ratingPrompt';
import {
  ThemedAlertModal,
  ThemedConfirmModal,
} from '../common/ThemedConfirmModal';
import { RateTechnicianModal } from './RateTechnicianModal';

/**
 * Near-instant live updates for clients, without waiting on push delivery.
 *
 * Detects technician assigned / dropped / service completed transitions and
 * surfaces branded dialogs. After "Service completed", the rate-technician
 * dialog is queued next.
 */
const POLL_MS = 15000;
const RATE_LIMIT_BACKOFF_MS = 90000;
const SNAPSHOT_KEY = 'atomik_booking_snapshot_v1';
const COMPLETED_SEEN_KEY = 'atomik_completed_dialog_seen_v1';
const MAX_QUEUED_EVENTS = 6;

type Snapshot = Record<string, { t: string | null; s: string }>;

interface LiveEvent {
  bookingId: string;
  kind: 'assigned' | 'dropped' | 'completed' | 'rate';
  techName?: string;
  service?: string;
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

export const ClientLiveEvents: React.FC<Props> = ({ navigationRef, enabled }) => {
  const snapshotRef = useRef<Snapshot | null>(null);
  const queueRef = useRef<LiveEvent[]>([]);
  const busyRef = useRef(false);
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
    async (
      bookingId: string,
      techName: string | undefined,
      service: string | undefined
    ) => {
      if (!(await hasSeenCompletedDialog(bookingId))) {
        enqueue({
          bookingId,
          kind: 'completed',
          techName,
          service,
        });
      }
      if (await shouldPromptRating(bookingId)) {
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

  const poll = useCallback(async () => {
    if (!enabled || busyRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;
    busyRef.current = true;
    try {
      const bookings = await bookingService.getMyBookings({ limit: 30 });
      const prev = snapshotRef.current;
      const next: Snapshot = {};
      let changed = false;

      for (const b of bookings) {
        const id = b._id;
        const techNow = resolveAssignedTechnicianId(b);
        const status = b.status;
        next[id] = { t: techNow, s: status };

        const prevEntry = prev?.[id];
        if (prevEntry) {
          if (prevEntry.t !== techNow || prevEntry.s !== status) changed = true;
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
            await enqueueCompletedFlow(
              id,
              b.technicianId?.name,
              b.serviceType
            );
          }
        } else if (prev) {
          changed = true;
          // App opened after completion while offline — announce once.
          if (status === 'completed' && techNow) {
            await enqueueCompletedFlow(
              id,
              b.technicianId?.name,
              b.serviceType
            );
          }
        }
      }

      if (prev) {
        for (const id of Object.keys(prev)) {
          if (!next[id]) {
            changed = true;
            break;
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
    }
  }, [enabled, enqueue, enqueueCompletedFlow]);

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
    }
    handleClose();
  }, [current, handleClose]);

  const handleRateDismiss = useCallback(async () => {
    const ev = current;
    if (ev?.kind === 'rate' && !(await hasRatedBooking(ev.bookingId))) {
      await markRatingSkipped(ev.bookingId);
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
