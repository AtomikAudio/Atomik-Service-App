import Constants from 'expo-constants';

/** Current production API (Render). */
export const PRODUCTION_API_URL =
  'https://atomik-service-app.onrender.com/api';

/** Retired host — remap any leftover references so installs never hit a dead 503. */
const LEGACY_API_HOSTS = ['atomik-api.onrender.com'] as const;

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function rewriteLegacyApiUrl(url: string): string {
  const lower = url.toLowerCase();
  if (LEGACY_API_HOSTS.some((host) => lower.includes(host))) {
    return PRODUCTION_API_URL;
  }
  return url;
}

/** Resolved at EAS build time from EXPO_PUBLIC_API_URL and app.config extra.apiUrl. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const candidate = fromEnv || fromExtra?.trim();

  if (candidate && !candidate.includes('localhost') && !candidate.includes('YOUR_')) {
    return rewriteLegacyApiUrl(normalizeApiUrl(candidate));
  }

  // Prefer the live Render API even in Expo Go so QR testing matches production.
  // Use EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:5000/api in frontend/.env for local backend.
  return PRODUCTION_API_URL;
}

export const API_TIMEOUT_MS =
  typeof __DEV__ !== 'undefined' && __DEV__ ? 15000 : 60000;

export function getApiOrigin(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}
