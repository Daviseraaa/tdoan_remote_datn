import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as workflowsApi from '@/src/api/workflows';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import type { CreateWorkflowDto } from '@/src/types/api';

export function useWorkflowsList(params: { page?: number; limit?: number } = {}) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.workflows(isAdmin, params),
    queryFn: () => workflowsApi.listWorkflows(isAdmin, params),
    refetchInterval: 10_000,
  });
}

export function useWorkflowDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.workflow(id ?? ''),
    queryFn: () => workflowsApi.getWorkflow(id!),
    enabled: !!id,
  });
}

export function useWorkflowMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['workflows'] });
    qc.invalidateQueries({ queryKey: ['workflow'] });
  };

  const create = useMutation({
    mutationFn: (dto: CreateWorkflowDto) => workflowsApi.createWorkflow(dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateWorkflowDto> }) =>
      workflowsApi.updateWorkflow(id, dto),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => workflowsApi.deleteWorkflow(id),
    onSuccess: invalidate,
  });

  const execute = useMutation({
    mutationFn: (id: string) => workflowsApi.executeWorkflowSync(id),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['workflow-runs'] });
    },
  });

  return { create, update, remove, execute };
}
