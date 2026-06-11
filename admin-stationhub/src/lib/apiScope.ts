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

export function agentWakePath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/wake` : `/agents/${id}/wake`;
}

export function agentRemoteAccessPath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/remote-access` : `/agents/${id}/remote-access`;
}

export function agentRemoteStartPath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/remote/start` : `/agents/${id}/remote/start`;
}

export function agentRemoteStopPath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/remote/stop` : `/agents/${id}/remote/stop`;
}

export function agentFilesListPath(admin: boolean, id: string, path?: string): string {
  const base = admin ? `/admin/agents/${id}/files` : `/agents/${id}/files`;
  if (!path) return base;
  const q = new URLSearchParams({ path });
  return `${base}?${q.toString()}`;
}

export function agentFilesDownloadPath(admin: boolean, id: string, path: string): string {
  const base = admin
    ? `/admin/agents/${id}/files/download`
    : `/agents/${id}/files/download`;
  const q = new URLSearchParams({ path });
  return `${base}?${q.toString()}`;
}

export function agentFilesWritePath(admin: boolean, id: string): string {
  return admin ? `/admin/agents/${id}/files/write` : `/agents/${id}/files/write`;
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
