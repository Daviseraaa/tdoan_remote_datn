/** REST paths: admin (global) vs tenant (current JWT user). */

export function agentsListPath(isAdmin: boolean): string {
  return isAdmin ? '/admin/agents' : '/agents';
}

export function agentDetailPath(isAdmin: boolean, id: string): string {
  return isAdmin ? `/admin/agents/${id}` : `/agents/${id}`;
}

export function agentDeletePath(isAdmin: boolean, id: string): string {
  return isAdmin ? `/admin/agents/${id}` : `/agents/${id}`;
}

export function agentRegeneratePath(isAdmin: boolean, id: string): string {
  return isAdmin
    ? `/admin/agents/${id}/regenerate-key`
    : `/agents/${id}/regenerate-key`;
}

export function tasksListPath(isAdmin: boolean): string {
  return isAdmin ? '/admin/tasks' : '/tasks';
}

export function taskDetailPath(isAdmin: boolean, id: string): string {
  return isAdmin ? `/admin/tasks/${id}` : `/tasks/${id}`;
}

export function taskCancelPath(isAdmin: boolean, id: string): string {
  return isAdmin ? `/admin/tasks/${id}` : `/tasks/${id}`;
}

export function workflowsListPath(isAdmin: boolean): string {
  return isAdmin ? '/admin/workflows' : '/workflows';
}
