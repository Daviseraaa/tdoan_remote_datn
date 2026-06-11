import { useQuery } from '@tanstack/react-query';
import * as workflowsApi from '@/src/api/workflows';
import { queryKeys } from '@/src/lib/queryKeys';
import type { WorkflowRunStatus } from '@/src/types/api';

export function useWorkflowRunsList(
  params: {
    page?: number;
    limit?: number;
    status?: WorkflowRunStatus | '';
    workflowId?: string;
  } = {},
) {
  const queryParams = {
    page: params.page,
    limit: params.limit,
    ...(params.status ? { status: params.status } : {}),
    ...(params.workflowId ? { workflowId: params.workflowId } : {}),
  };

  return useQuery({
    queryKey: queryKeys.workflowRuns(queryParams),
    queryFn: () => workflowsApi.listWorkflowRuns(queryParams),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      const hasActive = items.some(
        (r) => r.status === 'RUNNING' || r.status === 'PENDING',
      );
      return hasActive ? 5_000 : 30_000;
    },
  });
}

export function useWorkflowRunDetail(runId: string | null) {
  return useQuery({
    queryKey: queryKeys.workflowRun(runId ?? ''),
    queryFn: () => workflowsApi.getWorkflowRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'RUNNING' || status === 'PENDING' ? 3_000 : false;
    },
  });
}
