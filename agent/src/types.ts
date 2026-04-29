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

export type TaskType = 'COMMAND' | 'SCRIPT' | 'FILE_OPERATION' | 'SYSTEM_INFO';

export interface AgentMetadata {
  os?: string;
  hostname?: string;
  ip?: string;
  platform?: string;
  arch?: string;
  cpuCount?: number;
  totalMemory?: number;
  agentVersion?: string;
}

export interface HeartbeatPayload {
  timestamp: number;
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface TaskExecutePayload {
  taskId: string;
  type: TaskType;
  command: string;
  payload?: Record<string, unknown> | null;
  timeout: number;
}

export interface TaskResultPayload {
  taskId: string;
  status: 'COMPLETED' | 'FAILED';
  result: string;
  exitCode: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskProgressPayload {
  taskId: string;
  message: string;
  percent?: number;
}
