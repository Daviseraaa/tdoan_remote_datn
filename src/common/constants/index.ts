export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const TASK_QUEUE = 'task-queue';

export const WS_EVENTS = {
  AGENT_REGISTER: 'agent:register',
  AGENT_HEARTBEAT: 'agent:heartbeat',
  AGENT_DISCONNECT: 'agent:disconnect',
  AGENT_STATUS: 'agent:status',
  TASK_EXECUTE: 'task:execute',
  TASK_RESULT: 'task:result',
  TASK_PROGRESS: 'task:progress',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  REMOTE_SESSION: 'remote:session',
  REMOTE_END: 'remote:end',
  REMOTE_READY: 'remote:ready',
  REMOTE_OFFER: 'remote:offer',
  REMOTE_ANSWER: 'remote:answer',
  REMOTE_ICE: 'remote:ice',
  REMOTE_HEARTBEAT: 'remote:heartbeat',
  REMOTE_CONTROL: 'remote:control',
  REMOTE_TELEMETRY: 'remote:telemetry',
  REMOTE_RTT_REPORT: 'remote:rtt:report',
} as const;
