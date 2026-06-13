import { useAuth } from '@/src/hooks/useAuth';

/** Session đã load và user là ADMIN — dùng `enabled` cho mọi query/mutation `/admin/*`. */
export function useAdminQueryEnabled(): boolean {
  const { isAdmin, isLoading } = useAuth();
  return isAdmin && !isLoading;
}

/** Session đã load và user là USER thường — dùng `enabled` cho dashboard/query user scope. */
export function useUserQueryEnabled(): boolean {
  const { isAdmin, isLoading } = useAuth();
  return !isAdmin && !isLoading;
}
