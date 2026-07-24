import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef } from '@react-navigation/native';

import { bookingService } from '../../services/bookings';
import {
  emitBookingChanged,
  subscribeBookingChanged,
} from '../../services/liveUpdates';
import { navigateToBookingFromNotification } from '../../navigation/navigateFromNotification';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import {
  ThemedConfirmModal,
} from '../common/ThemedConfirmModal';

/**
 * Surfaces a branded "Service completed" dialog for admins when a booking
 * transitions to completed (poll-based, same reliability as client live events).
 */
const POLL_MS = 20000;
const RATE_LIMIT_BACKOFF_MS = 90000;
const SNAPSHOT_KEY = 'atomik_admin_booking_snapshot_v1';
const SEEN_KEY = 'atomik_admin_completed_seen_v1';
const MAX_QUEUED = 4;

type Snapshot = Record<string, { s: string; tech?: string | null }>;

interface LiveEvent {
  bookingId: string;
  bookingCode?: string;
  techName?: string;
  service?: string;
}

interface Props {
  navigationRef: React.RefObject<NavigationContainerRef<
    Record<string, object | undefined>
  > | null>;
  enabled: boolean;
}

async function hasSeen(bookingId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) && ids.includes(bookingId);
  } catch {
    return false;
  }
}

async function markSeen(bookingId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!Array.isArray(ids)) {
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([bookingId]));
      return;
    }
    if (ids.includes(bookingId)) return;
    ids.push(bookingId);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-120)));
  } catch {
    // ignore
  }
}

function formatService(service?: string): string {
  if (!service) return 'service';
  return service.replace(/[_-]+/g, ' ').trim() || 'service';
}

export const AdminLiveEvents: React.FC<Props> = ({ navigationRef, enabled }) => {
  const snapshotRef = useRef<Snapshot | null>(null);
  const queueRef = useRef<LiveEvent[]>([]);
  const busyRef = useRef(false);
  const pendingPollRef = useRef(false);
  const backoffUntilRef = useRef(0);
  const [current, setCurrent] = useState<LiveEvent | null>(null);

  const showNext = useCallback(() => {
    setCurrent((cur) => (cur ? cur : queueRef.current.shift() ?? null));
  }, []);

  const enqueue = useCallback(
    async (ev: LiveEvent) => {
      if (await hasSeen(ev.bookingId)) return;
      if (queueRef.current.length >= MAX_QUEUED) return;
      if (queueRef.current.some((q) => q.bookingId === ev.bookingId)) return;
      if (current?.bookingId === ev.bookingId) return;
      queueRef.current.push(ev);
      showNext();
    },
    [current, showNext]
  );

  const poll = useCallback(async () => {
    if (!enabled) return;
    if (Date.now() < backoffUntilRef.current) return;
    if (busyRef.current) {
      pendingPollRef.current = true;
      return;
    }
    busyRef.current = true;
    pendingPollRef.current = false;
    try {
      const bookings = await bookingService.getAllBookings({ limit: 40 });
      const prev = snapshotRef.current;
      const next: Snapshot = {};
      let changed = false;

      for (const b of bookings) {
        const id = b._id;
        const techId = resolveAssignedTechnicianId(b);
        next[id] = { s: b.status, tech: techId };

        const prevEntry = prev?.[id];
        if (prevEntry) {
          if (prevEntry.s !== b.status || prevEntry.tech !== techId) {
            changed = true;
          }
          if (prevEntry.s !== 'completed' && b.status === 'completed') {
            await enqueue({
              bookingId: id,
              bookingCode: b.bookingId,
              techName: b.technicianId?.name,
              service: b.serviceType,
            });
          }
        } else if (prev && b.status === 'completed') {
          changed = true;
          await enqueue({
            bookingId: id,
            bookingCode: b.bookingId,
            techName: b.technicianId?.name,
            service: b.serviceType,
          });
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
  }, [enabled, enqueue]);

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
        // ignore
      }
      if (cancelled) return;
      void poll();
      startInterval();
    })();

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
    if (current) void markSeen(current.bookingId);
    setCurrent(null);
    setTimeout(showNext, 250);
  }, [current, showNext]);

  const handleView = useCallback(() => {
    const ev = current;
    if (ev) void markSeen(ev.bookingId);
    setCurrent(null);
    const nav = navigationRef.current;
    if (nav && ev) {
      navigateToBookingFromNotification(
        {
          dispatch: nav.dispatch.bind(nav),
          navigate: nav.navigate.bind(nav) as (...args: any[]) => void,
        },
        'admin',
        ev.bookingId,
        { fromRoot: true }
      );
    }
    setTimeout(showNext, 400);
  }, [current, navigationRef, showNext]);

  if (!current) return null;

  const service = formatService(current.service);
  const tech = current.techName?.trim() || 'A technician';
  const code = current.bookingCode ? ` #${current.bookingCode}` : '';

  return (
    <ThemedConfirmModal
      visible
      title="Service completed"
      message={`${tech} marked the ${service} booking${code} as completed.`}
      confirmLabel="VIEW BOOKING"
      cancelLabel="OKAY"
      icon="checkmark-circle-outline"
      onConfirm={handleView}
      onCancel={handleClose}
    />
  );
};
