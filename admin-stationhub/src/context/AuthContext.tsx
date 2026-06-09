import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as authApi from '@/src/api/auth';
import * as usersApi from '@/src/api/users';
import { clearTokens, isAuthenticated, setTokens } from '@/src/lib/auth';
import { isAdmin } from '@/src/lib/apiScope';
import type { User } from '@/src/types/api';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    password: string,
    otp: string,
  ) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUser(null);
      return;
    }
    const me = await usersApi.getMe();
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isAuthenticated()) {
          await refreshUser();
        }
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await authApi.login(email, password);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      await queryClient.invalidateQueries();
      return data.user;
    },
    [queryClient],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      const data = await authApi.loginWithGoogle(idToken);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      await queryClient.invalidateQueries();
      return data.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, otp: string) => {
      const data = await authApi.register(name, email, password, otp);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      await queryClient.invalidateQueries();
      return data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAdmin: isAdmin(user),
      login,
      loginWithGoogle,
      register,
      logout,
      refreshUser,
    }),
    [user, isLoading, login, loginWithGoogle, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
