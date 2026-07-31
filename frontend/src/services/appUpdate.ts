import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { getApiBaseUrl } from '../config/apiConfig';

const DISMISSED_KEY = 'atomik_update_dismissed_for';

const DEFAULT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.atomikaudio.service';

export type AppVersionInfo = {
  latestVersion: string | null;
  latestVersionCode: number | null;
  minVersion: string | null;
  minVersionCode: number | null;
  forceUpdate: boolean;
  storeUrl: string;
  message: string;
};

export type UpdateCheckResult = {
  updateAvailable: boolean;
  forceUpdate: boolean;
  storeUrl: string;
  message: string;
  latestLabel: string;
  currentLabel: string;
};

/** Compare dotted version strings (1.1.6 vs 1.1.7). */
export function compareVersions(a: string, b: string): number {
  const pa = a
    .replace(/^v/i, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  const pb = b
    .replace(/^v/i, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function getInstalledVersion(): string {
  const c = Constants as unknown as {
    expoConfig?: { version?: string };
    nativeAppVersion?: string | null;
  };
  return (c.expoConfig?.version ?? c.nativeAppVersion ?? '0').trim();
}

export function getInstalledVersionCode(): number | null {
  const c = Constants as unknown as {
    expoConfig?: { android?: { versionCode?: number } };
    nativeBuildVersion?: string | number | null;
  };
  const fromConfig = c.expoConfig?.android?.versionCode;
  if (typeof fromConfig === 'number' && Number.isFinite(fromConfig)) {
    return fromConfig;
  }
  if (c.nativeBuildVersion != null) {
    const n = Number.parseInt(String(c.nativeBuildVersion), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchAppVersionInfo(): Promise<AppVersionInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${getApiBaseUrl()}/app/version`, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: Partial<AppVersionInfo>;
    };
    if (!json?.success || !json.data) return null;

    return {
      latestVersion: json.data.latestVersion ?? null,
      latestVersionCode:
        typeof json.data.latestVersionCode === 'number'
          ? json.data.latestVersionCode
          : null,
      minVersion: json.data.minVersion ?? null,
      minVersionCode:
        typeof json.data.minVersionCode === 'number'
          ? json.data.minVersionCode
          : null,
      forceUpdate: Boolean(json.data.forceUpdate),
      storeUrl: json.data.storeUrl?.trim() || DEFAULT_STORE_URL,
      message:
        json.data.message?.trim() ||
        'A newer version of ATOMIK is available. Update to continue with the latest fixes and features.',
    };
  } catch {
    return null;
  }
}

function isBelowMin(
  info: AppVersionInfo,
  currentVersion: string,
  currentCode: number | null
): boolean {
  if (
    info.minVersionCode != null &&
    currentCode != null &&
    currentCode < info.minVersionCode
  ) {
    return true;
  }
  if (info.minVersion && compareVersions(currentVersion, info.minVersion) < 0) {
    return true;
  }
  return false;
}

function isBehindLatest(
  info: AppVersionInfo,
  currentVersion: string,
  currentCode: number | null
): boolean {
  if (
    info.latestVersionCode != null &&
    currentCode != null &&
    currentCode < info.latestVersionCode
  ) {
    return true;
  }
  if (
    info.latestVersion &&
    compareVersions(currentVersion, info.latestVersion) < 0
  ) {
    return true;
  }
  return false;
}

function dismissalToken(info: AppVersionInfo): string {
  return `${info.latestVersion ?? 'x'}|${info.latestVersionCode ?? 'x'}`;
}

export async function wasUpdateDismissed(info: AppVersionInfo): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(DISMISSED_KEY);
    return stored === dismissalToken(info);
  } catch {
    return false;
  }
}

export async function dismissUpdatePrompt(info: AppVersionInfo): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, dismissalToken(info));
  } catch {
    // ignore
  }
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult | null> {
  // Play Store listing — Android only for this prompt.
  if (Platform.OS !== 'android') return null;

  const info = await fetchAppVersionInfo();
  if (!info) return null;

  // Nothing configured on server yet — no prompt.
  if (!info.latestVersion && info.latestVersionCode == null) return null;

  const currentVersion = getInstalledVersion();
  const currentCode = getInstalledVersionCode();
  const behind = isBehindLatest(info, currentVersion, currentCode);
  if (!behind) return null;

  const force =
    info.forceUpdate || isBelowMin(info, currentVersion, currentCode);

  if (!force && (await wasUpdateDismissed(info))) {
    return null;
  }

  const latestLabel =
    info.latestVersion != null
      ? info.latestVersionCode != null
        ? `v${info.latestVersion} (${info.latestVersionCode})`
        : `v${info.latestVersion}`
      : info.latestVersionCode != null
        ? `build ${info.latestVersionCode}`
        : 'latest';

  const currentLabel =
    currentCode != null ? `v${currentVersion} (${currentCode})` : `v${currentVersion}`;

  return {
    updateAvailable: true,
    forceUpdate: force,
    storeUrl: info.storeUrl || DEFAULT_STORE_URL,
    message: info.message,
    latestLabel,
    currentLabel,
  };
}

/** Open Play Store listing (market:// with https fallback). */
export async function openPlayStore(storeUrl?: string): Promise<void> {
  const httpsUrl = (storeUrl?.trim() || DEFAULT_STORE_URL).replace(
    /^http:\/\//i,
    'https://'
  );
  const packageId = 'com.atomikaudio.service';
  const marketUrl = `market://details?id=${packageId}`;

  try {
    if (Platform.OS === 'android') {
      const canMarket = await Linking.canOpenURL(marketUrl);
      if (canMarket) {
        await Linking.openURL(marketUrl);
        return;
      }
    }
    await Linking.openURL(httpsUrl);
  } catch {
    await Linking.openURL(httpsUrl).catch(() => {});
  }
}
