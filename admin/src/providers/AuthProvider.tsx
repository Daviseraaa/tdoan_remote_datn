import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, unwrap } from '@/lib/api';
import {
  clearAuth,
  getStoredUser,
  saveAuth,
} from '@/lib/auth';
import type { LoginResponse, User } from '@/types/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await api.get('/users/me');
        setUser(unwrap<User>(res));
      } catch {
        // interceptor handles 401 -> redirect
      }
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password });
    const payload = unwrap<LoginResponse>(res);
    saveAuth(payload);
    setUser(payload.user);
  }

  async function logout() {
    try {
      await api.post('/auth/logout', {
        refreshToken: localStorage.getItem('datn.admin.refreshToken') ?? '',
      });
    } catch {
      // ignore
    }
    clearAuth();
    setUser(null);
  }

  async function refreshProfile() {
    const res = await api.get('/users/me');
    const next = unwrap<User>(res);
    setUser(next);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isAdmin: user?.role === 'ADMIN',
      login,
      logout,
      refreshProfile,
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
