import api from './api';
import {
  clearToken,
  getToken,
  getCachedUser,
  getOnboardedFlag,
  isDemoSessionToken,
  setCachedUser,
  setOnboardedFlag,
  setToken,
} from './tokenStore';
import { getApiBaseUrl } from '../config/apiConfig';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'technician' | 'master_technician' | 'admin';
  avatar?: string;
}

interface LoginResponse {
  user: AuthUser;
  token: string;
}

interface ApiAuthPayload {
  success?: boolean;
  token?: string;
  user?: {
    id?: string;
    _id?: string;
    name: string;
    email: string;
    phone?: string;
    role: 'client' | 'technician' | 'master_technician' | 'admin';
    avatar?: string;
  };
  message?: string;
}

function unwrapAuthResponse(data: ApiAuthPayload): LoginResponse {
  if (!data?.token || !data?.user) {
    throw new Error(data?.message || 'Invalid response from server');
  }
  return {
    token: data.token,
    user: {
      id: String(data.user.id ?? data.user._id),
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone,
      role: data.user.role,
      avatar: data.user.avatar,
    },
  };
}

const API_BASE = getApiBaseUrl();

const CLIENT_DEMO_USER = {
  id: 'demo-client-1',
  name: 'Saurav Kumar',
  email: 'client@atomik.demo',
  phone: '+91 98765 43210',
  role: 'client' as const,
};

function getOfflineDemoPassword(): string | null {
  const password = process.env.EXPO_PUBLIC_DEMO_PASSWORD?.trim();
  return password || null;
}

function isDemoAuthEnabled(): boolean {
  return __DEV__;
}

function tryDemoLogin(email: string, password: string): LoginResponse | null {
  if (!isDemoAuthEnabled()) return null;

  const demoPassword = getOfflineDemoPassword();
  if (!demoPassword) return null;

  const key = email.trim().toLowerCase();
  if (key !== CLIENT_DEMO_USER.email || password !== demoPassword) {
    return null;
  }

  return {
    user: CLIENT_DEMO_USER,
    token: 'demo-token-client',
  };
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('cannot reach api') ||
    msg.includes('failed to fetch') ||
    msg.includes('request failed')
  );
}

export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403;
}

async function persistSession(data: LoginResponse): Promise<void> {
  await setToken(data.token);
  await setCachedUser(data.user);
  if (data.user.role !== 'client') {
    // Staff never see the client onboarding intro.
    await setOnboardedFlag(true);
  } else {
    // Clients see the onboarding intro every time they log in or sign up.
    // Reset the flag on each explicit auth so it reappears; OnboardingScreen
    // sets it back to true when finished, so app relaunches don't replay it.
    await setOnboardedFlag(false);
  }
}

async function withOnboardingState(
  data: LoginResponse
): Promise<LoginResponse & { isOnboarded: boolean }> {
  const onboarded = await getOnboardedFlag();
  return {
    ...data,
    isOnboarded: data.user.role !== 'client' || onboarded === true,
  };
}

export type OtpPurpose =
  | 'signup'
  | 'login'
  | 'technician_signup'
  | 'technician_login'
  | 'forgot_password';

export const authService = {
  async login(identifier: string, password: string): Promise<LoginResponse & { isOnboarded: boolean }> {
    const trimmed = identifier.trim();

    try {
      const raw = (await api.post('/auth/login', {
        identifier: trimmed,
        password,
      })) as ApiAuthPayload;
      const data = unwrapAuthResponse(raw);
      await persistSession(data);
      return withOnboardingState(data);
    } catch (err) {
      const offlineDemo = tryDemoLogin(trimmed, password);
      if (offlineDemo && isNetworkError(err)) {
        return withOnboardingState(offlineDemo);
      }
      throw err;
    }
  },

  async listTechnicians(): Promise<AuthUser[]> {
    const raw = (await api.get('/auth/technicians')) as {
      technicians?: Array<{
        id: string;
        name: string;
        email?: string;
        phone?: string;
        avatar?: string;
      }>;
    };
    return (raw.technicians ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email ?? '',
      phone: t.phone,
      role: 'technician' as const,
      avatar: t.avatar,
    }));
  },

  async sendOtp(
    phone: string,
    purpose: OtpPurpose = 'signup'
  ): Promise<{ expiresIn: number; phone: string; resendAfter: number }> {
    const raw = (await api.post('/auth/send-otp', {
      phone: phone.trim(),
      purpose,
    })) as {
      success?: boolean;
      message?: string;
      expiresIn?: number;
      phone?: string;
      resendAfter?: number;
    };
    if (!raw?.success) {
      throw new Error(raw?.message || 'Could not send verification code');
    }
    return {
      expiresIn: raw.expiresIn ?? 600,
      phone: raw.phone ?? phone.trim(),
      resendAfter: raw.resendAfter ?? 30,
    };
  },

  async verifyOtp(
    phone: string,
    otp: string,
    purpose: OtpPurpose = 'signup'
  ): Promise<{ phone: string; verified: boolean }> {
    const raw = (await api.post('/auth/verify-otp', {
      phone: phone.trim(),
      otp: otp.trim(),
      purpose,
    })) as {
      success?: boolean;
      message?: string;
      phone?: string;
      verified?: boolean;
    };
    if (!raw?.success) {
      throw new Error(raw?.message || 'Verification failed');
    }
    return {
      phone: raw.phone ?? phone.trim(),
      verified: raw.verified ?? true,
    };
  },

  /** @deprecated use sendOtp */
  async sendSignupOtp(phone: string) {
    return this.sendOtp(phone, 'signup');
  },

  async registerTechnician(payload: {
    name: string;
    phone: string;
    otp: string;
    email?: string;
  }): Promise<LoginResponse & { isOnboarded: boolean }> {
    const raw = (await api.post('/auth/register/technician', {
      name: payload.name,
      phone: payload.phone,
      otp: payload.otp.trim(),
      email: payload.email?.trim() || undefined,
    })) as ApiAuthPayload;
    const data = unwrapAuthResponse(raw);
    await persistSession(data);
    return withOnboardingState(data);
  },

  async loginWithPhone(
    phone: string,
    otp: string,
    role: 'client' | 'technician' = 'client'
  ): Promise<LoginResponse & { isOnboarded: boolean }> {
    const raw = (await api.post('/auth/login/phone', {
      phone: phone.trim(),
      otp: otp.trim(),
      role,
    })) as ApiAuthPayload;
    const data = unwrapAuthResponse(raw);
    await persistSession(data);
    return withOnboardingState(data);
  },

  async register(payload: {
    name: string;
    phone: string;
    password: string;
    otp: string;
    email?: string;
  }): Promise<LoginResponse & { isOnboarded: boolean }> {
    const normalizedEmail = payload.email?.trim().toLowerCase();
    try {
      const raw = (await api.post('/auth/register', {
        name: payload.name,
        password: payload.password,
        phone: payload.phone.trim(),
        otp: payload.otp.trim(),
        email: normalizedEmail || undefined,
      })) as ApiAuthPayload;
      const data = unwrapAuthResponse(raw);
      await persistSession(data);
      return withOnboardingState(data);
    } catch (err) {
      if (isDemoAuthEnabled() && isNetworkError(err)) {
        const demo: LoginResponse = {
          user: {
            id: `demo-${Date.now()}`,
            name: payload.name,
            email: normalizedEmail,
            phone: payload.phone,
            role: 'client',
          },
          token: 'demo-token-client',
        };
        return withOnboardingState(demo);
      }
      throw err;
    }
  },

  async forgotPassword(email: string): Promise<void> {
    try {
      await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
      });
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  },

  async resetPasswordWithPhone(
    phone: string,
    otp: string,
    password: string
  ): Promise<void> {
    const raw = (await api.post('/auth/reset-password-phone', {
      phone: phone.trim(),
      otp: otp.trim(),
      password,
    })) as { success?: boolean; message?: string };
    if (!raw?.success) {
      throw new Error(raw?.message || 'Could not reset password');
    }
  },

  async logout(): Promise<void> {
    await clearToken();
  },

  async deleteAccount(): Promise<void> {
    const raw = (await api.delete('/auth/account')) as {
      success?: boolean;
      message?: string;
    };
    if (!raw?.success) {
      throw new Error(raw?.message || 'Could not delete account');
    }
    await clearToken();
  },

  async updateProfile(payload: { name?: string; phone?: string; avatar?: string }) {
    const raw = (await api.patch('/auth/profile', payload)) as {
      user?: ApiAuthPayload['user'];
    };
    if (!raw?.user) throw new Error('Could not update profile');
    return unwrapAuthResponse({
      token: 'unused',
      user: raw.user,
    }).user;
  },

  async uploadAvatar(imageUri: string): Promise<AuthUser> {
    const token = await getToken();
    if (!token || token.startsWith('demo-token-')) {
      throw new Error('Sign in with your account (not demo mode) to upload a profile photo.');
    }

    const filename = imageUri.split('/').pop() || 'avatar.jpg';
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const formData = new FormData();
    formData.append('avatar', {
      uri: imageUri,
      name: filename,
      type: mime,
    } as unknown as Blob);

    const response = await fetch(`${API_BASE}/auth/profile/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = (await response.json()) as {
      success?: boolean;
      message?: string;
      user?: ApiAuthPayload['user'];
    };

    if (!response.ok || !data?.user) {
      throw new Error(data?.message || 'Could not upload profile photo');
    }

    return unwrapAuthResponse({ token: 'unused', user: data.user }).user;
  },

  async getCurrentUser(): Promise<LoginResponse['user']> {
    const token = await getToken();
    if (isDemoSessionToken(token)) {
      throw new Error('Demo session expired');
    }
    const raw = (await api.get('/auth/me')) as { user?: ApiAuthPayload['user'] };
    if (!raw?.user) {
      throw new Error('Could not load profile');
    }
    return unwrapAuthResponse({ token: 'unused', user: raw.user }).user;
  },

  /**
   * Restore a persisted session on app launch. Returns the saved user + token
   * if the stored JWT is still valid (kept up to 30 days by the backend).
   * Falls back to the cached user when the device is offline so reopening the
   * app keeps the user signed in.
   */
  /**
   * Fast, local-only session restore (no network). Returns the cached user +
   * token instantly so the app can render without waiting on the API. Use
   * loadStoredSession() afterwards to validate/refresh in the background.
   */
  async loadCachedSession(): Promise<
    (LoginResponse & { isOnboarded: boolean }) | null
  > {
    const token = await getToken();
    if (!token || isDemoSessionToken(token)) {
      return null;
    }
    const cached = await getCachedUser<AuthUser>();
    if (!cached) return null;
    const onboarded = await getOnboardedFlag();
    return {
      user: cached,
      token,
      isOnboarded: onboarded ?? cached.role !== 'client',
    };
  },

  async loadStoredSession(): Promise<
    (LoginResponse & { isOnboarded: boolean }) | null
  > {
    const token = await getToken();
    if (!token || isDemoSessionToken(token)) {
      await clearToken();
      return null;
    }

    const cached = await getCachedUser<AuthUser>();
    const onboarded = await getOnboardedFlag();

    try {
      const user = await this.getCurrentUser();
      await setCachedUser(user);
      return {
        user,
        token,
        isOnboarded: onboarded ?? user.role !== 'client',
      };
    } catch (err) {
      if (cached && (isNetworkError(err) || !isAuthError(err))) {
        return {
          user: cached,
          token,
          isOnboarded: onboarded ?? cached.role !== 'client',
        };
      }
      if (isAuthError(err)) {
        await clearToken();
        return null;
      }
      if (cached) {
        return {
          user: cached,
          token,
          isOnboarded: onboarded ?? cached.role !== 'client',
        };
      }
      await clearToken();
      return null;
    }
  },

  async getProfile(): Promise<LoginResponse['user']> {
    const token = await getToken();
    if (token === 'demo-token-client') {
      return CLIENT_DEMO_USER;
    }
    return this.getCurrentUser();
  },
};
