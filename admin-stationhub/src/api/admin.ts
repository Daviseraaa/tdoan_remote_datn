import { apiFetch } from '@/src/lib/api';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  AdminStats,
  AdminPaymentRecord,
  AdminWorkflowRun,
  AuditLogEntry,
  PaginatedResponse,
  SubscriptionPlan,
  Task,
  User,
} from '@/src/types/api';

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats');
}

export async function listAdminUsers(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<User>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/admin/users${query ? `?${query}` : ''}`);
  return normalizePaginated<User>(raw);
}

export async function listAdminPlans(): Promise<SubscriptionPlan[]> {
  return apiFetch<SubscriptionPlan[]>('/admin/plans');
}

export async function createAdminPlan(body: {
  name: string;
  originalPriceVnd: number;
  priceVnd: number;
  durationDays?: number;
  maxAgents?: number;
  description?: string;
  isActive?: boolean;
}): Promise<SubscriptionPlan> {
  return apiFetch<SubscriptionPlan>('/admin/plans', { method: 'POST', body });
}

export async function updateAdminPlan(
  id: string,
  body: Partial<{
    name: string;
    originalPriceVnd: number;
    priceVnd: number;
    durationDays: number;
    maxAgents: number;
    description: string;
    isActive: boolean;
  }>,
): Promise<SubscriptionPlan> {
  return apiFetch<SubscriptionPlan>(`/admin/plans/${id}`, { method: 'PATCH', body });
}

export async function deleteAdminPlan(id: string): Promise<{ message: string; id: string }> {
  return apiFetch<{ message: string; id: string }>(`/admin/plans/${id}`, { method: 'DELETE' });
}

export async function listAdminPayments(params: {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}): Promise<PaginatedResponse<AdminPaymentRecord>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  if (params.userId) q.set('userId', params.userId);
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/admin/payments${query ? `?${query}` : ''}`);
  return normalizePaginated<AdminPaymentRecord>(raw);
}

export async function listAdminWorkflowRuns(params: {
  page?: number;
  limit?: number;
  userId?: string;
  status?: string;
  triggerType?: string;
}): Promise<PaginatedResponse<AdminWorkflowRun>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.userId) q.set('userId', params.userId);
  if (params.status) q.set('status', params.status);
  if (params.triggerType) q.set('triggerType', params.triggerType);
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/admin/workflow-runs${query ? `?${query}` : ''}`);
  return normalizePaginated<AdminWorkflowRun>(raw);
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
