import { apiFetch } from '@/src/lib/api';
import { normalizePaginated } from '@/src/lib/normalize';
import type { AdminStats, AuditLogEntry, PaginatedResponse, Task } from '@/src/types/api';

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats');
}

export async function listAdminTasks(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Task>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/admin/tasks${query ? `?${query}` : ''}`);
  return normalizePaginated<Task>(raw);
}

export async function listAuditLogs(params: {
  page?: number;
  limit?: number;
  actor?: string;
  action?: string;
}): Promise<PaginatedResponse<AuditLogEntry>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.actor) q.set('actor', params.actor);
  if (params.action) q.set('action', params.action);
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/admin/audit-logs${query ? `?${query}` : ''}`);
  return normalizePaginated<AuditLogEntry>(raw);
}
