import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as taskTemplatesApi from '@/src/api/taskTemplates';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import type { CreateTaskTemplateDto } from '@/src/types/api';

export function useTaskTemplateDetail(id: string | null) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskTemplate(isAdmin, id ?? ''),
    queryFn: () => taskTemplatesApi.getTaskTemplate(isAdmin, id!),
    enabled: Boolean(id),
  });
}

export function useTaskTemplatesList(params: { page?: number; limit?: number } = {}) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.taskTemplates(isAdmin, params),
    queryFn: () => taskTemplatesApi.listTaskTemplates(isAdmin, params),
    refetchInterval: 30_000,
  });
}

export function useTaskTemplateMutations() {
  const { isAdmin } = useAuth();
  const adminEnabled = useAdminQueryEnabled();
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['task-templates'] });
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['task'] });
    if (adminEnabled) {
      void qc.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    }
  };

  const create = useMutation({
    mutationFn: (dto: CreateTaskTemplateDto) =>
      taskTemplatesApi.createTaskTemplate(isAdmin, dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateTaskTemplateDto> }) =>
      taskTemplatesApi.updateTaskTemplate(isAdmin, id, dto),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => taskTemplatesApi.deleteTaskTemplate(isAdmin, id),
    onSuccess: invalidate,
  });

  const run = useMutation({
    mutationFn: (id: string) => taskTemplatesApi.runTaskTemplate(isAdmin, id),
    onSuccess: invalidate,
  });

  return { create, update, remove, run };
}
