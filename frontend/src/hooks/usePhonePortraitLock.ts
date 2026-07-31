import { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/** Android large-screen breakpoint (sw600dp) — orientation locks are ignored here on API 36+. */
const LARGE_SCREEN_SHORTEST_DP = 600;

/**
 * Keep phones in portrait for UX, but leave tablets / unfolded foldables unlocked.
 * Manifest must NOT set screenOrientation — that is what Play Console flags.
 */
export function usePhonePortraitLock() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const isLargeScreen = shortest >= LARGE_SCREEN_SHORTEST_DP;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    (async () => {
      try {
        if (isLargeScreen) {
          await ScreenOrientation.unlockAsync();
        } else {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );
        }
      } catch {
        // Expo Go / missing native module — ignore
      }
    })();

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, [isLargeScreen]);
}
