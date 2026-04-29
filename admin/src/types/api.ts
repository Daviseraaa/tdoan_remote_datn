export type Role = 'ADMIN' | 'USER';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export type TaskType = 'COMMAND' | 'SCRIPT' | 'FILE_OPERATION' | 'SYSTEM_INFO';

export type TaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export type StepType = 'COMMAND' | 'SCRIPT' | 'DELAY' | 'CONDITION';

export type OnFailure = 'STOP' | 'SKIP' | 'RETRY';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  agentKey: string;
  status: AgentStatus;
  os?: string | null;
  hostname?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface TaskLog {
  id: string;
  level: LogLevel;
  message: string;
  createdAt: string;
  taskId: string;
}

export interface Task {
  id: string;
  type: TaskType;
  command?: string | null;
  payload?: Record<string, unknown> | null;
  status: TaskStatus;
  result?: string | null;
  exitCode?: number | null;
  priority: number;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  agentId: string;
  agent?: { name: string; status: AgentStatus };
  logs?: TaskLog[];
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: StepType;
  config: Record<string, unknown>;
  onFailure: OnFailure;
  workflowId: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  cronExpression?: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  steps: WorkflowStep[];
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  createdAt: string;
}

export interface AdminStats {
  users: { total: number; admins: number; active: number };
  agents: { total: number; online: number; offline: number; busy: number };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  workflows: { total: number; active: number };
  taskTrend: Array<{ date: string; completed: number; failed: number }>;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export type RemoteQualityProfile = 'low-latency' | 'balanced' | 'high-quality';
