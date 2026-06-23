import type { ScheduleKind, WorkflowTriggerType } from '@/src/api/triggers';

export const TELEGRAM_EVENTS = [
  'message',
  'command',
  'callback_query',
  'photo',
  'document',
  'edited_message',
] as const;

export const SCHEDULE_KINDS: ScheduleKind[] = ['DAILY', 'CRON', 'INTERVAL', 'HOURLY', 'ONCE'];

export type TelegramMatchConfig = {
  events?: string[];
  commands?: string[];
  variableArgs?: string[];
  progressChatId?: string;
};

export function parseMatchConfig(raw: unknown): TelegramMatchConfig {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as TelegramMatchConfig;
  return {
    events: Array.isArray(o.events) ? o.events : undefined,
    commands: Array.isArray(o.commands) ? o.commands : undefined,
    variableArgs: Array.isArray(o.variableArgs) ? o.variableArgs : undefined,
    progressChatId:
      typeof o.progressChatId === 'string' && o.progressChatId.trim()
        ? o.progressChatId.trim()
        : undefined,
  };
}

export function parseTelegramVariableArgNames(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Tên tham số đã nhập xong — bỏ qua segment cuối đang gõ dở (chưa có dấu phẩy). */
export function parseCommittedTelegramVariableArgNames(
  text: string,
  includeLastSegment = false,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (includeLastSegment) {
    return parseTelegramVariableArgNames(trimmed);
  }

  if (trimmed.endsWith(',')) {
    return parseTelegramVariableArgNames(trimmed);
  }

  const parts = trimmed.split(',');
  if (parts.length <= 1) return [];

  return parts
    .slice(0, -1)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseVariableArgsText(text: string): string[] | undefined {
  const names = parseTelegramVariableArgNames(text);
  return names.length ? names : undefined;
}

function telegramMatchConfig(opts: {
  telegramEvents: string[];
  commandsText: string;
  variableArgsText: string;
}): TelegramMatchConfig {
  const commands = opts.commandsText
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const variableArgs = parseVariableArgsText(opts.variableArgsText);
  return {
    events: opts.telegramEvents,
    ...(commands.length ? { commands } : {}),
    ...(variableArgs ? { variableArgs } : {}),
  };
}

export function buildTriggerPayload(opts: {
  type: WorkflowTriggerType;
  workflowId: string;
  name: string;
  enabled: boolean;
  timezone: string;
  scheduleKind: ScheduleKind;
  cronExpression: string;
  intervalMinutes: number;
  dailyHour: number;
  dailyMinute: number;
  runAtLocal: string;
  telegramBotId: string;
  commandsText: string;
  telegramEvents: string[];
  variableArgsText: string;
  progressChatId?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    type: opts.type,
    workflowId: opts.workflowId,
    name: opts.name.trim() || undefined,
    enabled: opts.enabled,
  };

  if (opts.type === 'SCHEDULE') {
    body.timezone = opts.timezone;
    body.scheduleKind = opts.scheduleKind;
    body.telegramBotId = opts.telegramBotId || undefined;
    if (opts.scheduleKind === 'CRON') body.cronExpression = opts.cronExpression.trim();
    if (opts.scheduleKind === 'INTERVAL') {
      body.intervalSeconds = Math.max(60, opts.intervalMinutes * 60);
    }
    if (opts.scheduleKind === 'DAILY') {
      body.dailyHour = opts.dailyHour;
      body.dailyMinute = opts.dailyMinute;
    }
    if (opts.scheduleKind === 'ONCE' && opts.runAtLocal) {
      body.runAt = new Date(opts.runAtLocal).toISOString();
    }
    if (opts.progressChatId?.trim()) {
      body.matchConfig = { progressChatId: opts.progressChatId.trim() };
    }
  }

  if (opts.type === 'TELEGRAM') {
    body.telegramBotId = opts.telegramBotId;
    body.matchConfig = telegramMatchConfig(opts);
  }

  return body;
}

export function buildPatchPayload(opts: {
  type: WorkflowTriggerType;
  name: string;
  enabled: boolean;
  timezone: string;
  scheduleKind: ScheduleKind;
  cronExpression: string;
  intervalMinutes: number;
  dailyHour: number;
  dailyMinute: number;
  runAtLocal: string;
  telegramBotId: string;
  commandsText: string;
  telegramEvents: string[];
  variableArgsText: string;
  progressChatId?: string;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    name: opts.name.trim() || undefined,
    enabled: opts.enabled,
  };

  if (opts.type === 'SCHEDULE') {
    patch.timezone = opts.timezone;
    patch.scheduleKind = opts.scheduleKind;
    patch.telegramBotId = opts.telegramBotId || undefined;
    patch.cronExpression =
      opts.scheduleKind === 'CRON' ? opts.cronExpression.trim() : undefined;
    patch.intervalSeconds =
      opts.scheduleKind === 'INTERVAL'
        ? Math.max(60, opts.intervalMinutes * 60)
        : undefined;
    patch.dailyHour = opts.scheduleKind === 'DAILY' ? opts.dailyHour : undefined;
    patch.dailyMinute = opts.scheduleKind === 'DAILY' ? opts.dailyMinute : undefined;
    if (opts.scheduleKind === 'ONCE' && opts.runAtLocal) {
      patch.runAt = new Date(opts.runAtLocal).toISOString();
    }
    patch.matchConfig = opts.progressChatId?.trim()
      ? { progressChatId: opts.progressChatId.trim() }
      : undefined;
  }

  if (opts.type === 'TELEGRAM') {
    patch.telegramBotId = opts.telegramBotId || undefined;
    patch.matchConfig = telegramMatchConfig(opts);
  }

  return patch;
}
