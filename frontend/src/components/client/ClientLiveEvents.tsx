import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NavigationContainerRef } from '@react-navigation/native';

import { bookingService } from '../../services/bookings';
import { resolveAssignedTechnicianId } from '../../utils/technicianBooking';
import { emitBookingChanged } from '../../services/liveUpdates';
import { navigateToBookingFromNotification } from '../../navigation/navigateFromNotification';
import { ThemedConfirmModal } from '../common/ThemedConfirmModal';

/**
 * Near-instant live updates for clients, without waiting on push delivery.
 *
 * Push notifications remain the ideal instant channel, but they can be delayed
 * or (on Android without FCM credentials) undelivered. This watcher polls the
 * client's bookings on a tight interval, and whenever anything changes it
 * broadcasts so every focused screen refetches immediately — so the UI updates
 * without the user switching tabs.
 *
 * It also detects "technician assigned" / "technician dropped" transitions and
 * surfaces a branded box on top of any screen. The last-seen state is persisted,
 * so a change that happened while the app was closed is announced on next open.
 */
const POLL_MS = 4000;
const SNAPSHOT_KEY = 'atomik_booking_snapshot_v1';
const MAX_QUEUED_EVENTS = 3;

type Snapshot = Record<string, { t: string | null; s: string }>;

interface LiveEvent {
  bookingId: string;
  kind: 'assigned' | 'dropped';
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

export const ClientLiveEvents: React.FC<Props> = ({ navigationRef, enabled }) => {
  const snapshotRef = useRef<Snapshot | null>(null);
  const queueRef = useRef<LiveEvent[]>([]);
  const busyRef = useRef(false);
  const [current, setCurrent] = useState<LiveEvent | null>(null);

  const showNext = useCallback(() => {
    setCurrent((cur) => (cur ? cur : queueRef.current.shift() ?? null));
  }, []);

  const enqueue = useCallback(
    (ev: LiveEvent) => {
      if (queueRef.current.length >= MAX_QUEUED_EVENTS) return;
      queueRef.current.push(ev);
      showNext();
    },
    [showNext]
  );

  const poll = useCallback(async () => {
    if (!enabled || busyRef.current) return;
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
          }
        } else if (prev) {
          changed = true;
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

      // Broadcast so every focused screen refetches right away.
      if (changed) emitBookingChanged();
    } catch {
      // Transient network errors — keep the last snapshot and retry next tick.
    } finally {
      busyRef.current = false;
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

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
        if (!cancelled && raw) snapshotRef.current = JSON.parse(raw) as Snapshot;
      } catch {
        // ignore corrupt cache
      }
      if (cancelled) return;
      void poll();
      interval = setInterval(() => void poll(), POLL_MS);
    })();

    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') void poll();
      }
    );

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      appStateSub.remove();
    };
  }, [enabled, poll]);

  const handleClose = useCallback(() => {
    setCurrent(null);
    setTimeout(showNext, 250);
  }, [showNext]);

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
        ev.bookingId
      );
    }
    setTimeout(showNext, 400);
  }, [current, navigationRef, showNext]);

  if (!current) return null;

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
