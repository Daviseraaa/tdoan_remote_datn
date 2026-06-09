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
  TASK_RUNNING: 'task:running',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  CHROME_PROFILES_SYNC: 'agent:chrome-profiles:sync',
  CHROME_PROFILES_RESULT: 'agent:chrome-profiles:result',
  CHROME_SCRIPTS_SYNC: 'agent:chrome-scripts:sync',
  CHROME_SCRIPTS_RESULT: 'agent:chrome-scripts:result',
  DESKTOP_RECORDINGS_SYNC: 'agent:desktop-recordings:sync',
  DESKTOP_RECORDINGS_RESULT: 'agent:desktop-recordings:result',
  AGENT_SUBSCRIPTION_EXPIRED: 'agent:subscription:expired',
  AGENT_SESSION_REVOKED: 'agent:session:revoked',
} as const;
