import * as triggersApi from '@/src/api/triggers';
import type { ScheduleKind, WorkflowTrigger, WorkflowTriggerType } from '@/src/api/triggers';
import { buildPatchPayload, buildTriggerPayload, parseMatchConfig } from '@/src/lib/triggerForm';
import { t } from '@/src/i18n/t';

export type EntryTriggerDraft = {
  triggerId: string | null;
  /** Loại đã lưu DB (khi đổi loại cần tạo lại bản ghi) */
  persistedType: WorkflowTriggerType | null;
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
};

export function defaultEntryTriggerDraft(): EntryTriggerDraft {
  return {
    triggerId: null,
    persistedType: null,
    type: 'MANUAL',
    name: '',
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    scheduleKind: 'DAILY',
    cronExpression: '0 8 * * *',
    intervalMinutes: 5,
    dailyHour: 8,
    dailyMinute: 0,
    runAtLocal: '',
    telegramBotId: '',
    commandsText: '/run',
    telegramEvents: ['message', 'command', 'callback_query'],
  };
}

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function draftFromWorkflowTrigger(tr: WorkflowTrigger | null): EntryTriggerDraft {
  const base = defaultEntryTriggerDraft();
  if (!tr) return base;
  const mc = parseMatchConfig(tr.matchConfig);
  return {
    ...base,
    triggerId: tr.id,
    persistedType: tr.type,
    type: tr.type,
    name: tr.name ?? '',
    enabled: tr.enabled,
    timezone: tr.timezone ?? base.timezone,
    scheduleKind: tr.scheduleKind ?? base.scheduleKind,
    cronExpression: tr.cronExpression ?? base.cronExpression,
    intervalMinutes: tr.intervalSeconds
      ? Math.round(tr.intervalSeconds / 60)
      : base.intervalMinutes,
    dailyHour: tr.dailyHour ?? base.dailyHour,
    dailyMinute: tr.dailyMinute ?? base.dailyMinute,
    runAtLocal: toDatetimeLocal(tr.runAt),
    telegramBotId: tr.telegramBotId ?? '',
    commandsText: mc.commands?.length ? mc.commands.join(', ') : base.commandsText,
    telegramEvents: mc.events?.length ? mc.events : base.telegramEvents,
  };
}

/** Trigger “điểm vào” ưu tiên bản ghi mới nhất (API đã sort desc). */
export function pickEntryTrigger(triggers: WorkflowTrigger[]): WorkflowTrigger | null {
  if (!triggers.length) return null;
  const auto = triggers.find((tr) => tr.type === 'SCHEDULE' || tr.type === 'TELEGRAM');
  return auto ?? triggers[0];
}

export function entryTriggerNodeLabel(draft: EntryTriggerDraft): string {
  if (draft.name.trim()) return draft.name.trim();
  if (draft.type === 'SCHEDULE') {
    if (draft.scheduleKind === 'CRON' && draft.cronExpression.trim()) {
      return draft.cronExpression.trim();
    }
    if (draft.scheduleKind === 'DAILY') {
      return t('workflows.triggerScheduleDaily', {
        hour: draft.dailyHour,
        minute: String(draft.dailyMinute).padStart(2, '0'),
      });
    }
    if (draft.scheduleKind === 'INTERVAL') {
      return t('workflows.triggerScheduleInterval', { minutes: draft.intervalMinutes });
    }
    return t('workflows.triggerSchedule');
  }
  if (draft.type === 'TELEGRAM') return t('workflows.triggerTelegram');
  return t('workflows.triggerManual');
}

export function entryTriggerTypeSubtitle(type: WorkflowTriggerType): string {
  if (type === 'SCHEDULE') return t('triggers.typeSchedule');
  if (type === 'TELEGRAM') return t('triggers.typeTelegram');
  return t('triggers.typeManual');
}

function formOpts(workflowId: string, draft: EntryTriggerDraft) {
  return {
    type: draft.type,
    workflowId,
    name: draft.name,
    enabled: true,
    timezone: draft.timezone,
    scheduleKind: draft.scheduleKind,
    cronExpression: draft.cronExpression,
    intervalMinutes: draft.intervalMinutes,
    dailyHour: draft.dailyHour,
    dailyMinute: draft.dailyMinute,
    runAtLocal: draft.runAtLocal,
    telegramBotId: draft.telegramBotId,
    commandsText: draft.commandsText,
    telegramEvents: draft.telegramEvents,
  };
}

export async function persistEntryTrigger(
  workflowId: string,
  draft: EntryTriggerDraft,
  opts?: { createBot?: { name: string; botToken: string } },
): Promise<EntryTriggerDraft> {
  let botId = draft.telegramBotId;

  if (draft.type === 'TELEGRAM') {
    if (opts?.createBot) {
      const bot = await triggersApi.createTelegramBot({
        name: opts.createBot.name.trim(),
        botToken: opts.createBot.botToken.trim(),
      });
      botId = bot.id;
    }
    if (!botId) {
      throw new Error(t('triggers.errBotRequired'));
    }
  }

  const withBot = { ...draft, telegramBotId: botId };
  const fo = formOpts(workflowId, withBot);

  if (draft.type === 'MANUAL') {
    if (draft.triggerId) {
      await triggersApi.deleteTrigger(draft.triggerId);
    }
    return { ...defaultEntryTriggerDraft(), type: 'MANUAL' };
  }

  const typeChanged =
    draft.triggerId && draft.persistedType && draft.persistedType !== draft.type;

  if (draft.triggerId && !typeChanged) {
    const updated = await triggersApi.patchTrigger(
      draft.triggerId,
      buildPatchPayload(fo),
    );
    return draftFromWorkflowTrigger(updated);
  }

  if (draft.triggerId) {
    await triggersApi.deleteTrigger(draft.triggerId);
  }

  const created = await triggersApi.createTrigger(buildTriggerPayload(fo));
  return draftFromWorkflowTrigger(created);
}
