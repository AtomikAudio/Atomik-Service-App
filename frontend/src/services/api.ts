import axios from 'axios';
import { clearToken, getToken, isDemoSessionToken } from './tokenStore';
import { API_TIMEOUT_MS, getApiBaseUrl } from '../config/apiConfig';

const BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

let onUnauthorized: (() => void) | null = null;

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token && !isDemoSessionToken(token)) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      const msg = String(error.response?.data?.message ?? '');
      const isPaymentProviderAuth =
        msg.includes('Razorpay') ||
        msg.includes('Payment provider') ||
        msg.includes('Authentication failed');
      if (!isPaymentProviderAuth) {
        await clearToken();
        onUnauthorized?.();
      }
    }
    if (!error.response) {
      const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
      const hint = isDev
        ? 'Cannot reach API. Check backend is running and EXPO_PUBLIC_API_URL uses your PC LAN IP.'
        : 'Cannot reach API. The server may be waking up (free hosting) — wait a moment and try again.';
      return Promise.reject(
        new Error(
          error.code === 'ECONNABORTED'
            ? `Request timed out. ${isDev ? hint : 'Server is starting up — please try again in a few seconds.'}`
            : `Network error. ${hint}`
        )
      );
    }
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    const apiError = new Error(message) as Error & {
      status?: number;
      retryAfter?: number;
    };
    apiError.status = error.response?.status;
    if (typeof error.response?.data?.retryAfter === 'number') {
      apiError.retryAfter = error.response.data.retryAfter;
    }
    return Promise.reject(apiError);
  }
);

export default api;
