import { useAuthContext } from '@/src/context/AuthContext';

export function useAuth() {
  return useAuthContext();
}
