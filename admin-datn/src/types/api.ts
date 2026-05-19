export type Role = 'ADMIN' | 'USER';

export type TaskStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export type TaskType =
  | 'COMMAND'
  | 'SCRIPT'
  | 'FILE_OPERATION'
  | 'SYSTEM_INFO'
  | 'OPEN_APP'
  | 'DESKTOP_AUTOMATION';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export type WorkflowStepType = 'COMMAND' | 'SCRIPT' | 'DELAY' | 'CONDITION';
export type WorkflowStepOnFailure = 'STOP' | 'SKIP' | 'RETRY';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  os?: string;
  hostname?: string;
  ip?: string;
  status: AgentStatus;
  userId?: string;
  lastSeenAt?: string;
  lastHeartbeatAt?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  agentKey?: string;
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  command?: string;
  agentId: string;
  agent?: Agent;
  userId?: string;
  result?: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export interface WorkflowStep {
  id?: string;
  order: number;
  type: WorkflowStepType;
  config: Record<string, unknown>;
  onFailure?: WorkflowStepOnFailure;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  cronExpression?: string;
  isActive: boolean;
  steps?: WorkflowStep[];
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastExecutedAt?: string;
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
  taskTrend: Array<{
    at: string;
    date: string;
    completed: number;
    failed: number;
  }>;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateAgentDto {
  name: string;
  os?: string;
  hostname?: string;
}

export interface CreateTaskDto {
  type: TaskType;
  agentId: string;
  command: string;
  timeout?: number;
  payload?: Record<string, unknown>;
  priority?: number;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  cronExpression?: string;
  isActive?: boolean;
  steps: WorkflowStep[];
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface UpdateUserDto {
  name?: string;
  role?: Role;
}
