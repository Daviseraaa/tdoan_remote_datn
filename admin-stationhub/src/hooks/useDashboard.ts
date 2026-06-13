import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/src/api/admin';
import * as agentsApi from '@/src/api/agents';
import * as tasksApi from '@/src/api/tasks';
import * as workflowsApi from '@/src/api/workflows';
import {
  useAdminQueryEnabled,
  useUserQueryEnabled,
} from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';

const DASHBOARD_STALE_MS = 30_000;
const DASHBOARD_GC_MS = 5 * 60_000;

const dashboardQueryDefaults = {
  staleTime: DASHBOARD_STALE_MS,
  gcTime: DASHBOARD_GC_MS,
} as const;

export function useAdminDashboard(enabled: boolean) {
  const stats = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => adminApi.getAdminStats(),
    refetchInterval: enabled ? 15_000 : false,
    enabled,
    ...dashboardQueryDefaults,
  });

  const statsReady = enabled && stats.isSuccess;

  const recentTasks = useQuery({
    queryKey: queryKeys.adminTasks({ page: 1, limit: 8 }),
    queryFn: () => adminApi.listAdminTasks({ page: 1, limit: 8 }),
    refetchInterval: statsReady ? 10_000 : false,
    enabled: statsReady,
    ...dashboardQueryDefaults,
  });

  const healthAgents = useQuery({
    queryKey: queryKeys.agents(true, { page: 1, limit: 50 }),
    queryFn: () => agentsApi.listAgents(true, { page: 1, limit: 50 }),
    refetchInterval: statsReady ? 10_000 : false,
    enabled: statsReady,
    ...dashboardQueryDefaults,
  });

  return { stats, recentTasks, healthAgents };
}

export function useUserDashboard(enabled: boolean) {
  const agentsPreview = useQuery({
    queryKey: queryKeys.agents(false, { page: 1, limit: 50 }),
    queryFn: () => agentsApi.listAgents(false, { page: 1, limit: 50 }),
    refetchInterval: enabled ? 10_000 : false,
    enabled,
    ...dashboardQueryDefaults,
  });

  const workflowsCount = useQuery({
    queryKey: queryKeys.workflows(false, { page: 1, limit: 1 }),
    queryFn: () => workflowsApi.listWorkflows(false, { page: 1, limit: 1 }),
    refetchInterval: enabled ? 15_000 : false,
    enabled,
    ...dashboardQueryDefaults,
  });

  const recentTasks = useQuery({
    queryKey: queryKeys.tasks(false, { page: 1, limit: 8 }),
    queryFn: () => tasksApi.listTasks(false, { page: 1, limit: 8 }),
    refetchInterval: enabled ? 10_000 : false,
    enabled,
    ...dashboardQueryDefaults,
  });

  return { agentsPreview, workflowsCount, recentTasks };
}

export function useDashboard() {
  const adminEnabled = useAdminQueryEnabled();
  const userEnabled = useUserQueryEnabled();
  const admin = useAdminDashboard(adminEnabled);
  const user = useUserDashboard(userEnabled);
  return adminEnabled
    ? { mode: 'admin' as const, ...admin }
    : { mode: 'user' as const, ...user };
}
