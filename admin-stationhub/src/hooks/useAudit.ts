import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/src/api/admin';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';

export function useAuditLogs(params: {
  page?: number;
  limit?: number;
  actor?: string;
  action?: string;
  resource?: string;
  resourceIn?: string;
  from?: string;
  to?: string;
}) {
  const adminEnabled = useAdminQueryEnabled();
  return useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: () => adminApi.listAuditLogs(params),
    enabled: adminEnabled,
  });
}
