import Constants from 'expo-constants';

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

/** Resolved at EAS build time from EXPO_PUBLIC_API_URL and app.config extra.apiUrl. */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const candidate = fromEnv || fromExtra?.trim();

  if (candidate && !candidate.includes('localhost') && !candidate.includes('YOUR_')) {
    return normalizeApiUrl(candidate);
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'http://localhost:5000/api';
  }

  return 'https://atomik-service-app.onrender.com/api';
}

export const API_TIMEOUT_MS =
  typeof __DEV__ !== 'undefined' && __DEV__ ? 15000 : 60000;

export function getApiOrigin(): string {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
}
