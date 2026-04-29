import type { AgentStatus, TaskStatus } from '@/types/api';

export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  PENDING: 'default',
  QUEUED: 'blue',
  RUNNING: 'processing',
  COMPLETED: 'success',
  FAILED: 'error',
  TIMEOUT: 'warning',
  CANCELLED: 'default',
};

export const AGENT_STATUS_COLOR: Record<AgentStatus, string> = {
  ONLINE: 'success',
  OFFLINE: 'default',
  BUSY: 'warning',
};
