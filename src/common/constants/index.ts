export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const TASK_QUEUE = 'task-queue';

export const WS_EVENTS = {
  AGENT_REGISTER: 'agent:register',
  AGENT_HEARTBEAT: 'agent:heartbeat',
  AGENT_TELEMETRY: 'agent:telemetry',
  AGENT_DISCONNECT: 'agent:disconnect',
  AGENT_STATUS: 'agent:status',
  TASK_EXECUTE: 'task:execute',
  TASK_RESULT: 'task:result',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
} as const;
