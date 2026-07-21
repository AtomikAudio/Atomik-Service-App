import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Version-aware cache busting.
 *
 * When a new build/version is installed (or an OTA JS revision changes), any
 * locally cached data from the previous version can make the app look/behave
 * like the old version. On launch we compare the running version against the
 * last one we recorded; if it changed, we drop stale caches so the fresh build
 * always starts clean — while keeping the login session, onboarding flag and
 * user preferences so people are not logged out or re-onboarded by an update.
 */
const VERSION_KEY = 'atomik_app_version';

/** Keys that must survive an update (session + user choices). */
const PRESERVE_KEYS = new Set<string>([
  'atomik_token', // AsyncStorage fallback session token (SecureStore is separate)
  'atomik_onboarded', // don't re-run onboarding after an update
  'atomik_notification_prefs', // user's notification preferences
  VERSION_KEY,
]);

/**
 * A tag that changes whenever the installed binary or JS bundle changes.
 * Combines the app version, the native build number, and the OTA update id
 * (when present) so both store updates and JS-only updates are detected.
 */
export function getAppVersionTag(): string {
  const c = Constants as unknown as {
    expoConfig?: { version?: string };
    nativeBuildVersion?: string | number | null;
    nativeAppVersion?: string | null;
  };
  const version = c.expoConfig?.version ?? c.nativeAppVersion ?? '0';
  const build = c.nativeBuildVersion != null ? String(c.nativeBuildVersion) : '0';
  return `${version}+${build}`;
}

/** Human-readable version string for display, e.g. "v1.1.4 (12)". */
export function getReadableAppVersion(): string {
  const c = Constants as unknown as {
    expoConfig?: { version?: string };
    nativeBuildVersion?: string | number | null;
    nativeAppVersion?: string | null;
  };
  const version = c.expoConfig?.version ?? c.nativeAppVersion ?? '0';
  const build = c.nativeBuildVersion != null ? String(c.nativeBuildVersion) : null;
  return build ? `v${version} (${build})` : `v${version}`;
}

/**
 * Clears stale caches when the app version changed. Safe to call on every
 * launch — it no-ops when the version is unchanged. Returns true when a
 * version change was detected and caches were cleared.
 */
export async function runAppVersionCacheGuard(): Promise<boolean> {
  const current = getAppVersionTag();

  let previous: string | null = null;
  try {
    previous = await AsyncStorage.getItem(VERSION_KEY);
  } catch {
    // If we can't read it, treat as unchanged to avoid nuking a good cache.
    return false;
  }

  if (previous === current) return false;

  // Version changed (install/update/OTA). Drop everything except the
  // allowlisted session + preference keys so no stale cached data survives.
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((k) => !PRESERVE_KEYS.has(k));
    if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // Best-effort — never block startup on cache cleanup.
  }

  try {
    await AsyncStorage.setItem(VERSION_KEY, current);
  } catch {
    // ignore
  }

  return true;
}
