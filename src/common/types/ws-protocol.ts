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
  ip?: string;
  cpuPercent?: number;
  ramUsedBytes?: number;
  ramTotalBytes?: number;
  ramLabel?: string;
  /** @deprecated legacy agent builds */
  uptime?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface TaskExecutePayload {
  taskId: string;
  /** Khớp Prisma `TaskType` hoặc giá trị mở rộng sau migration. */
  type: string;
  command: string;
  payload?: Record<string, unknown> | null;
  timeout: number;
}

export interface TaskResultPayload {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
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
