import type { User } from '@/types/api';

const ACCESS_KEY = 'datn.admin.accessToken';
const REFRESH_KEY = 'datn.admin.refreshToken';
const USER_KEY = 'datn.admin.user';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function saveAuth(params: {
  accessToken: string;
  refreshToken: string;
  user: User;
}) {
  localStorage.setItem(ACCESS_KEY, params.accessToken);
  localStorage.setItem(REFRESH_KEY, params.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(params.user));
}

export function updateAccessToken(accessToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
}

export function clearAuth() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
