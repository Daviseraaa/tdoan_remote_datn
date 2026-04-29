import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from 'axios';
import type { ApiResponse } from '@/types/api';
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
} from './auth';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:3000/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
});

let refreshPromise: Promise<string> | null = null;

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function doRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');
  const res = await axios.post<ApiResponse<{ accessToken: string }>>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );
  const next = res.data.data.accessToken;
  updateAccessToken(next);
  return next;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true;
      try {
        if (!refreshPromise) refreshPromise = doRefresh();
        const newToken = await refreshPromise;
        refreshPromise = null;
        if (!original.headers) original.headers = {};
        (original.headers as Record<string, string>).Authorization =
          `Bearer ${newToken}`;
        return api.request(original);
      } catch (err) {
        refreshPromise = null;
        clearAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);

export function unwrap<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}

function stringifyMessage(msg: unknown): string | null {
  if (msg == null) return null;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.map(String).join(', ');
  return null;
}

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const raw = err.response?.data;
    if (raw && typeof raw === 'object') {
      const data = raw as Record<string, unknown>;
      const nested = data.error;
      if (nested && typeof nested === 'object') {
        const fromNested = stringifyMessage(
          (nested as Record<string, unknown>).message,
        );
        if (fromNested) return fromNested;
      }
      if (typeof nested === 'string') return nested;
      const top = stringifyMessage(data.message);
      if (top) return top;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}
