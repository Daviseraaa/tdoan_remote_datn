import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tasksApi from '@/src/api/tasks';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import type { CreateTaskDto, TaskStatus, TaskType } from '@/src/types/api';

export function useTasksList(params: {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  type?: TaskType;
} = {}) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.tasks(isAdmin, params),
    queryFn: () => tasksApi.listTasks(isAdmin, params),
    refetchInterval: 10_000,
  });
}

export function useTaskDetail(taskId: string | null) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: ['task', isAdmin, taskId],
    queryFn: () => tasksApi.getTask(isAdmin, taskId!),
    enabled: !!taskId,
    refetchInterval: 3_000,
  });
}

export function useTaskMutations() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task'] });
    qc.invalidateQueries({ queryKey: ['admin', 'tasks'] });
    qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };

  const create = useMutation({
    mutationFn: (dto: CreateTaskDto) => tasksApi.createTask(dto),
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: (id: string) => tasksApi.cancelTask(isAdmin, id),
    onSuccess: invalidate,
  });

  const retry = useMutation({
    mutationFn: (id: string) => tasksApi.retryTask(isAdmin, id),
    onSuccess: invalidate,
  });

  return { create, cancel, retry };
}
