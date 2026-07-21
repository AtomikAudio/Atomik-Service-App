import { useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { subscribeBookingChanged } from '../services/liveUpdates';

interface LiveRefreshOptions {
  /** Polling fallback interval while focused (ms). Pass 0 to disable polling. */
  intervalMs?: number;
  /** Skip all live refreshing when false (e.g. while an action is in flight). */
  enabled?: boolean;
}

/**
 * Keeps a focused screen live without the user manually re-entering it.
 *
 * While the screen is focused it silently refreshes:
 *  - instantly when a push notification arrives in the foreground,
 *  - when the app returns to the foreground, and
 *  - on a polling interval as a safety net (covers missed/denied pushes).
 *
 * `refresh` should be a *silent* reload (no full-screen spinner, no wiping
 * existing data on transient errors).
 */
export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  { intervalMs = 15000, enabled = true }: LiveRefreshOptions = {}
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;

      const run = () => {
        void refreshRef.current();
      };

      const unsubscribe = subscribeBookingChanged(run);

      const appStateSub = AppState.addEventListener(
        'change',
        (state: AppStateStatus) => {
          if (state === 'active') run();
        }
      );

      const interval = intervalMs > 0 ? setInterval(run, intervalMs) : null;

      return () => {
        unsubscribe();
        appStateSub.remove();
        if (interval) clearInterval(interval);
      };
    }, [enabled, intervalMs])
  );
}
