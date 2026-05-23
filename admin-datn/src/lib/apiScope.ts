import type { User } from '@/src/types/api';

export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === 'ADMIN';
}

export function agentsListPath(admin: boolean): string {
  return admin ? '/admin/agents' : '/agents';
}

export function agentDetailPath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}` : `/agents/${id}`;
}

export function agentDeletePath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}` : `/agents/${id}`;
}

export function agentRegenerateKeyPath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/regenerate-key` : `/agents/${id}/regenerate-key`;
}

export function tasksListPath(admin: boolean): string {
  return admin ? '/admin/tasks' : '/tasks';
}

export function taskDetailPath(admin: boolean, id: string): string {
  return admin ? `/admin/tasks/${id}` : `/tasks/${id}`;
}

export function taskDeletePath(admin: boolean, id: string): string {
  return admin ? `/admin/tasks/${id}` : `/tasks/${id}`;
}

export function taskRetryPath(admin: boolean, id: string): string {
  return admin ? `/admin/tasks/${id}/retry` : `/tasks/${id}/retry`;
}

export function taskTemplatesBasePath(admin: boolean): string {
  return admin ? '/admin/tasks/templates' : '/tasks/templates';
}

export function workflowsListPath(admin: boolean): string {
  return admin ? '/admin/workflows' : '/workflows';
}
