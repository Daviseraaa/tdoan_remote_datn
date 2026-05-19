import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/src/api/admin';
import * as agentsApi from '@/src/api/agents';
import * as tasksApi from '@/src/api/tasks';
import * as workflowsApi from '@/src/api/workflows';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';

export function useAdminDashboard() {
  const stats = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => adminApi.getAdminStats(),
    refetchInterval: 15_000,
  });

  const recentTasks = useQuery({
    queryKey: queryKeys.adminTasks({ page: 1, limit: 8 }),
    queryFn: () => adminApi.listAdminTasks({ page: 1, limit: 8 }),
    refetchInterval: 10_000,
  });

  const healthAgents = useQuery({
    queryKey: queryKeys.agents(true, { page: 1, limit: 50 }),
    queryFn: () => agentsApi.listAgents(true, { page: 1, limit: 50 }),
    refetchInterval: 10_000,
  });

  return { stats, recentTasks, healthAgents };
}

export function useUserDashboard() {
  const agentsCount = useQuery({
    queryKey: queryKeys.agents(false, { page: 1, limit: 1 }),
    queryFn: () => agentsApi.listAgents(false, { page: 1, limit: 1 }),
    refetchInterval: 15_000,
  });

  const agentsPreview = useQuery({
    queryKey: queryKeys.agents(false, { page: 1, limit: 50 }),
    queryFn: () => agentsApi.listAgents(false, { page: 1, limit: 50 }),
    refetchInterval: 10_000,
  });

  const tasksCount = useQuery({
    queryKey: queryKeys.tasks(false, { page: 1, limit: 1 }),
    queryFn: () => tasksApi.listTasks(false, { page: 1, limit: 1 }),
    refetchInterval: 15_000,
  });

  const workflowsCount = useQuery({
    queryKey: queryKeys.workflows(false, { page: 1, limit: 1 }),
    queryFn: () => workflowsApi.listWorkflows(false, { page: 1, limit: 1 }),
    refetchInterval: 15_000,
  });

  const recentTasks = useQuery({
    queryKey: queryKeys.tasks(false, { page: 1, limit: 8 }),
    queryFn: () => tasksApi.listTasks(false, { page: 1, limit: 8 }),
    refetchInterval: 10_000,
  });

  return { agentsCount, agentsPreview, tasksCount, workflowsCount, recentTasks };
}

export function useDashboard() {
  const { isAdmin } = useAuth();
  const admin = useAdminDashboard();
  const user = useUserDashboard();
  return isAdmin ? { mode: 'admin' as const, ...admin } : { mode: 'user' as const, ...user };
}
