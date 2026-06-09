import { apiFetch } from '@/src/lib/api';
import { taskTemplatesBasePath } from '@/src/lib/apiScope';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  CreateTaskTemplateDto,
  PaginatedResponse,
  Task,
  TaskTemplate,
} from '@/src/types/api';

export async function getTaskTemplate(
  admin: boolean,
  id: string,
): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`${taskTemplatesBasePath(admin)}/${id}`);
}

export async function listTaskTemplates(
  admin: boolean,
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResponse<TaskTemplate>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const path = taskTemplatesBasePath(admin);
  const query = q.toString();
  const raw = await apiFetch<unknown>(`${path}${query ? `?${query}` : ''}`);
  return normalizePaginated<TaskTemplate>(raw);
}

export async function createTaskTemplate(
  admin: boolean,
  dto: CreateTaskTemplateDto,
): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(taskTemplatesBasePath(admin), {
    method: 'POST',
    body: dto,
  });
}

export async function updateTaskTemplate(
  admin: boolean,
  id: string,
  dto: Partial<CreateTaskTemplateDto>,
): Promise<TaskTemplate> {
  return apiFetch<TaskTemplate>(`${taskTemplatesBasePath(admin)}/${id}`, {
    method: 'PATCH',
    body: dto,
  });
}

export async function deleteTaskTemplate(
  admin: boolean,
  id: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`${taskTemplatesBasePath(admin)}/${id}`, {
    method: 'DELETE',
  });
}

export async function runTaskTemplate(admin: boolean, id: string): Promise<Task> {
  return apiFetch<Task>(`${taskTemplatesBasePath(admin)}/${id}/run`, {
    method: 'POST',
  });
}
