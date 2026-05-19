import { apiFetch } from '@/src/lib/api';
import {
  taskDeletePath,
  taskDetailPath,
  taskRetryPath,
  tasksListPath,
} from '@/src/lib/apiScope';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  CreateTaskDto,
  PaginatedResponse,
  Task,
  TaskStatus,
  TaskType,
} from '@/src/types/api';

export async function listTasks(
  admin: boolean,
  params: {
    page?: number;
    limit?: number;
    status?: TaskStatus;
    type?: TaskType;
  } = {},
): Promise<PaginatedResponse<Task>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.type) q.set('type', params.type);
  const query = q.toString();
  const path = tasksListPath(admin);
  const raw = await apiFetch<unknown>(`${path}${query ? `?${query}` : ''}`);
  return normalizePaginated<Task>(raw);
}

export async function getTask(admin: boolean, id: string): Promise<Task> {
  return apiFetch<Task>(taskDetailPath(admin, id));
}

export async function createTask(dto: CreateTaskDto): Promise<Task> {
  return apiFetch<Task>('/tasks', { method: 'POST', body: dto });
}

export async function cancelTask(admin: boolean, id: string): Promise<void> {
  return apiFetch<void>(taskDeletePath(admin, id), { method: 'DELETE' });
}

export async function retryTask(admin: boolean, id: string): Promise<Task> {
  return apiFetch<Task>(taskRetryPath(admin, id), { method: 'POST' });
}
