import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/src/api/admin';
import { queryKeys } from '@/src/lib/queryKeys';

export function useAuditLogs(params: {
  page?: number;
  limit?: number;
  actor?: string;
  action?: string;
}) {
  return useQuery({
    queryKey: queryKeys.audit(params),
    queryFn: () => adminApi.listAuditLogs(params),
  });
}
