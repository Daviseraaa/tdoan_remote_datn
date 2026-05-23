import { apiFetch } from '@/src/lib/api';
import { workflowsListPath } from '@/src/lib/apiScope';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  CreateWorkflowDto,
  ExecuteWorkflowResult,
  ExecuteWorkflowStartResult,
  PaginatedResponse,
  Workflow,
  WorkflowRunDetail,
  WorkflowStep,
} from '@/src/types/api';

export async function listWorkflows(
  admin: boolean,
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResponse<Workflow>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const query = q.toString();
  const path = workflowsListPath(admin);
  const raw = await apiFetch<unknown>(`${path}${query ? `?${query}` : ''}`);
  return normalizePaginated<Workflow>(raw);
}

export async function getWorkflow(id: string): Promise<Workflow> {
  return apiFetch<Workflow>(`/workflows/${id}`);
}

export async function createWorkflow(dto: CreateWorkflowDto): Promise<Workflow> {
  return apiFetch<Workflow>('/workflows', { method: 'POST', body: dto });
}

export async function updateWorkflow(
  id: string,
  dto: Partial<CreateWorkflowDto>,
): Promise<Workflow> {
  return apiFetch<Workflow>(`/workflows/${id}`, { method: 'PATCH', body: dto });
}

export async function deleteWorkflow(id: string): Promise<void> {
  return apiFetch<void>(`/workflows/${id}`, { method: 'DELETE' });
}

/** Chạy async (202) — trả runId, poll GET /workflows/runs/:runId */
export async function executeWorkflow(
  id: string,
): Promise<ExecuteWorkflowStartResult> {
  return apiFetch<ExecuteWorkflowStartResult>(`/workflows/${id}/execute`, {
    method: 'POST',
  });
}

/** Chạy đồng bộ — chờ đến khi xong */
export async function executeWorkflowSync(
  id: string,
): Promise<ExecuteWorkflowResult> {
  return apiFetch<ExecuteWorkflowResult>(`/workflows/${id}/execute?wait=true`, {
    method: 'POST',
  });
}

export async function getWorkflowRun(runId: string): Promise<WorkflowRunDetail> {
  return apiFetch<WorkflowRunDetail>(`/workflows/runs/${runId}`);
}

export type { WorkflowStep };
