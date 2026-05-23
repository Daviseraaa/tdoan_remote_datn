import type { ApiEnvelope } from '@/src/types/api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from '@/src/lib/auth';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const envelope = (await res.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken?: string;
    }>;
    const data = envelope.data;
    setTokens(data.accessToken, data.refreshToken ?? refreshToken);
    return true;
  } catch {
    return false;
  }
}

export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success) {
    throw new Error('API request failed');
  }
  return envelope.data;
}

function formatApiMessage(message: unknown): string | null {
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message
      .map((m) => (typeof m === 'string' ? m : formatApiMessage(m)))
      .filter((m): m is string => Boolean(m));
    return parts.length ? parts.join(', ') : null;
  }
  if (typeof message === 'object' && message !== null) {
    const nested = message as { message?: unknown };
    if (nested.message !== undefined) return formatApiMessage(nested.message);
  }
  return null;
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg && msg !== '[object Object]') return msg;
  }
  if (typeof err === 'object' && err !== null) {
    const direct = formatApiMessage((err as { message?: unknown }).message);
    if (direct) return direct;
    const fromError = formatApiMessage((err as { error?: unknown }).error);
    if (fromError) return fromError;
  }
  return 'Đã xảy ra lỗi không mong đợi';
}

function extractHttpErrorMessage(json: unknown, status: number): string {
  if (typeof json !== 'object' || json === null) {
    return `Yêu cầu thất bại (${status})`;
  }
  const body = json as Record<string, unknown>;
  const fromMessage = formatApiMessage(body.message);
  if (fromMessage) return fromMessage;
  const errField = body.error;
  if (typeof errField === 'string') return errField;
  if (typeof errField === 'object' && errField !== null) {
    const fromNested = formatApiMessage((errField as { message?: unknown }).message);
    if (fromNested) return fromNested;
  }
  return `Yêu cầu thất bại (${status})`;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, skipAuth, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      const token = getAccessToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      res = await doFetch();
    } else {
      clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(extractHttpErrorMessage(json, res.status));
  }

  return unwrap<T>(json as ApiEnvelope<T>);
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
