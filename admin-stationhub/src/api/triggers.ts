import { apiFetch } from '@/src/lib/api';

export type WorkflowTriggerType = 'MANUAL' | 'SCHEDULE' | 'TELEGRAM';
export type ScheduleKind = 'CRON' | 'INTERVAL' | 'DAILY' | 'HOURLY' | 'ONCE';

export interface TriggerExecution {
  id: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  workflowRunId?: string | null;
  error?: string | null;
}

export interface WorkflowTrigger {
  id: string;
  name?: string | null;
  type: WorkflowTriggerType;
  enabled: boolean;
  timezone: string;
  scheduleKind?: ScheduleKind | null;
  cronExpression?: string | null;
  intervalSeconds?: number | null;
  dailyHour?: number | null;
  dailyMinute?: number | null;
  runAt?: string | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  lastRunStatus?: string | null;
  matchConfig?: { events?: string[]; commands?: string[] } | null;
  telegramBotId?: string | null;
  workflow: { id: string; name: string; isActive: boolean };
  telegramBot?: { id: string; name: string; botUsername?: string | null } | null;
  executions?: TriggerExecution[];
}

export interface TelegramBot {
  id: string;
  name: string;
  botUsername?: string | null;
  mode: string;
  enabled: boolean;
  webhookUrl?: string | null;
  allowedChatIds?: string[] | null;
  allowedUserIds?: string[] | null;
}

export async function listTriggers(workflowId?: string): Promise<WorkflowTrigger[]> {
  const q = workflowId ? `?workflowId=${workflowId}` : '';
  return apiFetch<WorkflowTrigger[]>(`/triggers${q}`);
}

export async function getTrigger(id: string): Promise<WorkflowTrigger> {
  return apiFetch<WorkflowTrigger>(`/triggers/${id}`);
}

export async function createTrigger(body: Record<string, unknown>): Promise<WorkflowTrigger> {
  return apiFetch<WorkflowTrigger>('/triggers', { method: 'POST', body });
}

export async function patchTrigger(
  id: string,
  body: Record<string, unknown>,
): Promise<WorkflowTrigger> {
  return apiFetch<WorkflowTrigger>(`/triggers/${id}`, { method: 'PATCH', body });
}

export async function deleteTrigger(id: string): Promise<void> {
  return apiFetch<void>(`/triggers/${id}`, { method: 'DELETE' });
}

export async function listTelegramBots(): Promise<TelegramBot[]> {
  return apiFetch<TelegramBot[]>('/triggers/telegram/bots');
}

export async function createTelegramBot(body: {
  name: string;
  botToken: string;
}): Promise<TelegramBot> {
  return apiFetch<TelegramBot>('/triggers/telegram/bots', { method: 'POST', body });
}

export async function deleteTelegramBot(botId: string): Promise<void> {
  return apiFetch<void>(`/triggers/telegram/bots/${botId}`, { method: 'DELETE' });
}

export async function patchTelegramBot(
  botId: string,
  body: {
    name?: string;
    enabled?: boolean;
    allowedChatIds?: string;
    allowedUserIds?: string;
  },
): Promise<TelegramBot> {
  return apiFetch<TelegramBot>(`/triggers/telegram/bots/${botId}`, {
    method: 'PATCH',
    body,
  });
}
