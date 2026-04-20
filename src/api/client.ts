import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const DEFAULT_BASE_URL = 'https://admin.aimenu.ge';

const baseURL =
  (typeof process !== 'undefined' &&
    (process.env.EXPO_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL)) ||
  DEFAULT_BASE_URL;

const TOKEN_KEY = 'aimenu_pos_access_token';
const REFRESH_KEY = 'aimenu_pos_refresh_token';

export const tokenStore = {
  async get(): Promise<string | null> {
    return AsyncStorage.getItem(TOKEN_KEY);
  },
  async set(access: string, refresh?: string) {
    await AsyncStorage.setItem(TOKEN_KEY, access);
    if (refresh !== undefined) await AsyncStorage.setItem(REFRESH_KEY, refresh);
  },
  async getRefresh(): Promise<string | null> {
    return AsyncStorage.getItem(REFRESH_KEY);
  },
  async clear() {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
  },
};

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

// The backend wraps some responses as { success, data } and others just return
// plain JSON. Unwrap transparently like the web frontend does.
api.interceptors.response.use(response => {
  if (
    response.data &&
    typeof response.data === 'object' &&
    'success' in response.data &&
    response.data.success === true &&
    'data' in response.data
  ) {
    response.data = response.data.data;
  }
  return response;
});

api.interceptors.request.use(async config => {
  const token = await tokenStore.get();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight token refresh — avoids stampeding the refresh endpoint when
// parallel requests all 401 at the same time.
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) return null;
      const response = await axios.post<{ access: string }>(
        `${baseURL}/api/v1/auth/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const access = response.data?.access;
      if (access) {
        await tokenStore.set(access);
        return access;
      }
      return null;
    } catch {
      await tokenStore.clear();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

api.interceptors.response.use(
  r => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const fresh = await refreshAccessToken();
      if (fresh && original.headers) {
        original.headers.Authorization = `Bearer ${fresh}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export { baseURL };
