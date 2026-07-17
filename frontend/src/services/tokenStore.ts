import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'atomik_token';
const USER_KEY = 'atomik_user';
const ONBOARDED_KEY = 'atomik_onboarded';

let secureStoreAvailable: boolean | null = null;

/** Offline demo sessions must not survive app restarts. */
export function isDemoSessionToken(token: string | null | undefined): boolean {
  return !!token && token.startsWith('demo-token-');
}

async function canUseSecureStore(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch {
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

export async function getToken(): Promise<string | null> {
  if (await canUseSecureStore()) {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      // fall through
    }
  }
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function purgeDemoSessionToken(): Promise<void> {
  const token = await getToken();
  if (isDemoSessionToken(token)) {
    await clearToken();
  }
}

export async function setToken(token: string): Promise<void> {
  if (isDemoSessionToken(token)) {
    return;
  }
  if (await canUseSecureStore()) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await AsyncStorage.removeItem(TOKEN_KEY);
      return;
    } catch {
      // fall through
    }
  }
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (await canUseSecureStore()) {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
  await AsyncStorage.removeItem(TOKEN_KEY);
  await clearCachedUser();
}

/** Cached user profile for instant session restore on app launch (non-secret). */
export async function setCachedUser(user: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export async function getCachedUser<T = unknown>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}

/** Client onboarding completion — persisted so reopening the app skips onboarding. */
export async function setOnboardedFlag(value: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDED_KEY, value ? '1' : '0');
  } catch {
    // ignore
  }
}

export async function getOnboardedFlag(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDED_KEY);
    if (raw === null) return null;
    return raw === '1';
  } catch {
    return null;
  }
}

export async function clearOnboardedFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDED_KEY);
  } catch {
    // ignore
  }
}