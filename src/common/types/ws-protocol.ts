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
  type: 'COMMAND' | 'SCRIPT' | 'FILE_OPERATION' | 'SYSTEM_INFO';
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

export const MAX_RESULT_SIZE = 1_000_000;
