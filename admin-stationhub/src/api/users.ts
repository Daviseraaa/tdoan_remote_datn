import { apiFetch } from '@/src/lib/api';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  CreateUserDto,
  PaginatedResponse,
  UpdateUserDto,
  User,
} from '@/src/types/api';

export async function getMe(): Promise<User> {
  return apiFetch<User>('/users/me');
}

export async function listUsers(params: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<User>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  const query = q.toString();
  const raw = await apiFetch<unknown>(`/users${query ? `?${query}` : ''}`);
  return normalizePaginated<User>(raw);
}

export async function createUser(dto: CreateUserDto): Promise<User> {
  return apiFetch<User>('/admin/users', { method: 'POST', body: dto });
}

export async function updateUser(id: string, dto: UpdateUserDto): Promise<User> {
  return apiFetch<User>(`/admin/users/${id}`, { method: 'PATCH', body: dto });
}

export async function toggleUserActive(id: string): Promise<User> {
  return apiFetch<User>(`/users/${id}/toggle-active`, { method: 'PATCH' });
}

export async function deleteUser(id: string): Promise<void> {
  return apiFetch<void>(`/users/${id}`, { method: 'DELETE' });
}
