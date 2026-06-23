import type { ReactNode } from 'react';
import { CalendarClock, Loader2, MessageCircle, PlayCircle } from 'lucide-react';
import type { ScheduleKind, WorkflowTriggerType } from '@/src/api/triggers';
import {
  type EntryTriggerDraft,
  type EntryTriggerPatch,
  entryTriggerTypeSubtitle,
} from '@/src/lib/workflowEntryTrigger';
import { SCHEDULE_KINDS, TELEGRAM_EVENTS, parseTelegramVariableArgNames } from '@/src/lib/triggerForm';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';
import { WfInspectorBlock, WfInspectorSubsection } from './WfInspectorLayout';
import { WorkflowVariablesEditor } from './WorkflowVariablesEditor';

const inputCls =
  'w-full mt-1 px-3 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';

const labelCls =
  'text-[10px] font-mono font-bold uppercase text-on-surface-variant block';

type Props = {
  draft: EntryTriggerDraft;
  loading?: boolean;
  workflowActive: boolean;
  workflowId?: string;
  workflowVariables?: Record<string, unknown>;
  workflowVarKeys?: string[];
  onWorkflowVariablesChange?: (variables: Record<string, unknown>) => void;
  onChange: (patch: EntryTriggerPatch) => void;
};

const TRIGGER_TYPES: WorkflowTriggerType[] = ['MANUAL', 'SCHEDULE', 'TELEGRAM'];

const TELEGRAM_EVENT_PRESETS: { id: string; events: string[] }[] = [
  { id: 'command', events: ['command', 'callback_query'] },
  { id: 'message', events: ['message', 'command', 'callback_query'] },
  { id: 'all', events: [...TELEGRAM_EVENTS] },
];

function TypeOption({
  type,
  active,
  onSelect,
}: {
  type: WorkflowTriggerType;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon =
    type === 'SCHEDULE' ? CalendarClock : type === 'TELEGRAM' ? MessageCircle : PlayCircle;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex-1 min-w-[88px] flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all',
        active
          ? 'border-primary bg-primary/15 text-primary shadow-lg shadow-primary/10'
          : 'border-white/10 bg-white/[0.02] text-on-surface-variant hover:bg-white/5',
      )}
    >
      <Icon size={20} />
      <span className="text-[11px] font-bold leading-tight">{entryTriggerTypeSubtitle(type)}</span>
    </button>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={labelCls}>{children}</label>;
}

function buildTelegramRunExample(commandsText: string, variableArgsText: string): string {
  const firstCmd = commandsText.split(',')[0]?.trim() || '/run';
  const base = firstCmd.startsWith('/') ? firstCmd : `/${firstCmd}`;
  const cmd = base.split('@')[0] ?? base;
  const argNames = parseTelegramVariableArgNames(variableArgsText);
  const samples =
    argNames.length > 0
      ? argNames.map((_, i) => `bien${i + 1}`)
      : ['bien1', 'bien2'];
  return `${cmd} ${samples.join(' ')}`.trim();
}

function ScheduleConfig({
  draft,
  onChange,
}: {
  draft: EntryTriggerDraft;
  onChange: (patch: EntryTriggerPatch) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>{t('triggers.fieldScheduleKind')}</FieldLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SCHEDULE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ scheduleKind: k })}
              className={cn(
                'px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-colors',
                draft.scheduleKind === k
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(`triggers.scheduleKind_${k}` as 'triggers.scheduleKind_DAILY')}
            </button>
          ))}
        </div>
      </div>

      {draft.scheduleKind === 'CRON' ? (
        <div>
          <FieldLabel>{t('workflows.cronExpression')}</FieldLabel>
          <input
            value={draft.cronExpression}
            onChange={(e) => onChange({ cronExpression: e.target.value })}
            placeholder="0 8 * * *"
            className={cn(inputCls, 'font-mono')}
          />
        </div>
      ) : null}

      {draft.scheduleKind === 'INTERVAL' ? (
        <div>
          <FieldLabel>{t('triggers.fieldIntervalMinutes')}</FieldLabel>
          <input
            type="number"
            min={1}
            value={draft.intervalMinutes}
            onChange={(e) => onChange({ intervalMinutes: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
      ) : null}

      {draft.scheduleKind === 'DAILY' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>{t('triggers.fieldHour')}</FieldLabel>
            <input
              type="number"
              min={0}
              max={23}
              value={draft.dailyHour}
              onChange={(e) => onChange({ dailyHour: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel>{t('triggers.fieldMinute')}</FieldLabel>
            <input
              type="number"
              min={0}
              max={59}
              value={draft.dailyMinute}
              onChange={(e) => onChange({ dailyMinute: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>
      ) : null}

      {draft.scheduleKind === 'ONCE' ? (
        <div>
          <FieldLabel>{t('triggers.fieldRunAt')}</FieldLabel>
          <input
            type="datetime-local"
            value={draft.runAtLocal}
            onChange={(e) => onChange({ runAtLocal: e.target.value })}
            className={inputCls}
          />
        </div>
      ) : null}

      <div>
        <FieldLabel>{t('triggers.fieldTimezone')}</FieldLabel>
        <input
          value={draft.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
          className={cn(inputCls, 'font-mono')}
        />
      </div>
    </div>
  );
}

function VarArgQuickPick({
  keys,
  value,
  onChange,
}: {
  keys: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  if (!keys.length) return null;
  const current = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const append = (name: string) => {
    if (current.includes(name)) return;
    onChange([...current, name].join(', '));
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => append(k)}
          disabled={current.includes(k)}
          className={cn(
            'px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold transition-colors',
            current.includes(k)
              ? 'border-sky-400/30 bg-sky-400/10 text-sky-300/50 cursor-default'
              : 'border-sky-400/25 text-sky-200/90 hover:bg-sky-400/10',
          )}
        >
          + {k}
        </button>
      ))}
    </div>
  );
}

function TelegramConfig({
  draft,
  workflowVarKeys,
  onChange,
}: {
  draft: EntryTriggerDraft;
  workflowVarKeys: string[];
  onChange: (patch: EntryTriggerPatch) => void;
}) {
  const toggleEvent = (ev: string) => {
    const next = draft.telegramEvents.includes(ev)
      ? draft.telegramEvents.filter((x) => x !== ev)
      : [...draft.telegramEvents, ev];
    onChange({ telegramEvents: next });
  };

  const applyPreset = (events: string[]) => onChange({ telegramEvents: [...events] });

  const activePreset =
    TELEGRAM_EVENT_PRESETS.find(
      (p) =>
        p.events.length === draft.telegramEvents.length &&
        p.events.every((e) => draft.telegramEvents.includes(e)),
    )?.id ?? 'custom';

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>{t('triggers.selectBot')}</FieldLabel>
        <WfTelegramBotSelect
          value={draft.telegramBotId}
          onChange={(id) => onChange({ telegramBotId: id })}
          autoSelectFirst={!draft.telegramBotId}
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-black/15 p-3 space-y-3">
        <div>
          <FieldLabel>{t('triggers.fieldCommands')}</FieldLabel>
          <input
            value={draft.commandsText}
            onChange={(e) => onChange({ commandsText: e.target.value })}
            placeholder="/run, /start"
            className={cn(inputCls, 'font-mono')}
          />
        </div>
        <div>
          <span className={labelCls}>{t('triggers.fieldEvents')}</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TELEGRAM_EVENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.events)}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors',
                  activePreset === p.id
                    ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/10 text-on-surface-variant hover:bg-white/5',
                )}
              >
                {t(`workflows.triggerEventPreset_${p.id}` as 'workflows.triggerEventPreset_command')}
              </button>
            ))}
          </div>
          {activePreset === 'custom' ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {TELEGRAM_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] cursor-pointer',
                    draft.telegramEvents.includes(ev)
                      ? 'border-cyan-400/30 bg-cyan-400/10'
                      : 'border-white/10',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={draft.telegramEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="sr-only"
                  />
                  {ev}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-sky-400/15 bg-sky-950/20 p-3 space-y-2">
        <FieldLabel>{t('workflows.triggerTelegramVarArgs')}</FieldLabel>
        <input
          value={draft.variableArgsText}
          onChange={(e) => onChange({ variableArgsText: e.target.value })}
          onBlur={(e) =>
            onChange({ variableArgsText: e.target.value, variableArgsCommitted: true })
          }
          placeholder={t('triggers.fieldVariableArgsPlaceholder')}
          className={cn(inputCls, 'font-mono bg-black/20')}
        />
        <VarArgQuickPick
          keys={workflowVarKeys}
          value={draft.variableArgsText}
          onChange={(variableArgsText) => onChange({ variableArgsText })}
        />
        <p className="text-[10px] font-mono text-cyan-300/75 pt-0.5">
          {t('workflows.triggerTelegramRunExample', {
            example: buildTelegramRunExample(draft.commandsText, draft.variableArgsText),
          })}
        </p>
      </div>
    </div>
  );
}

export function WorkflowTriggerInspector({
  draft,
  loading = false,
  workflowActive,
  workflowId,
  workflowVariables,
  workflowVarKeys: workflowVarKeysProp,
  onWorkflowVariablesChange,
  onChange,
}: Props) {
  const workflowVarKeys =
    workflowVarKeysProp ?? Object.keys(workflowVariables ?? {});

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar min-w-0 w-full">
      <h3 className="text-sm font-bold text-on-surface px-0.5">{t('workflows.triggerStartTitle')}</h3>

      <WfInspectorBlock tone="properties" className="space-y-3">
        {loading ? (
          <div className="space-y-3 animate-pulse" aria-busy>
            <div className="h-3 w-24 rounded bg-white/10" />
            <div className="flex flex-wrap gap-2">
              {TRIGGER_TYPES.map((type) => (
                <div key={type} className="h-16 w-[88px] rounded-xl bg-white/5 border border-white/10" />
              ))}
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Loader2 size={14} className="animate-spin text-primary" />
              {t('workflows.loadingTrigger')}
            </div>
          </div>
        ) : (
          <>
        <div>
          <FieldLabel>{t('workflows.triggerType')}</FieldLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {TRIGGER_TYPES.map((type) => (
              <TypeOption
                key={type}
                type={type}
                active={draft.type === type}
                onSelect={() => onChange({ type })}
              />
            ))}
          </div>
        </div>

        {draft.type !== 'MANUAL' ? (
          <div>
            <FieldLabel>{t('triggers.fieldName')}</FieldLabel>
            <input
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t('triggers.fieldNamePlaceholder')}
              className={inputCls}
            />
          </div>
        ) : null}

        {!workflowActive ? (
          <p className="text-xs text-error rounded-xl border border-error/30 bg-error/10 p-3">
            {t('triggers.workflowInactiveHint')}
          </p>
        ) : null}
          </>
        )}
      </WfInspectorBlock>

      {!loading && (draft.type === 'SCHEDULE' || draft.type === 'TELEGRAM') ? (
        <WfInspectorBlock tone="config" className="space-y-4">
          {draft.type === 'SCHEDULE' ? (
            <ScheduleConfig draft={draft} onChange={onChange} />
          ) : null}

          {draft.type === 'TELEGRAM' ? (
            <TelegramConfig
              draft={draft}
              workflowVarKeys={workflowVarKeys}
              onChange={onChange}
            />
          ) : null}
        </WfInspectorBlock>
      ) : null}

      {onWorkflowVariablesChange ? (
        <WfInspectorBlock tone="vars">
          <WfInspectorSubsection title={t('workflows.triggerEntryVars')} tone="workflow">
            <WorkflowVariablesEditor
              key={workflowId}
              variables={workflowVariables}
              onChange={onWorkflowVariablesChange}
            />
          </WfInspectorSubsection>
        </WfInspectorBlock>
      ) : null}
    </div>
  );
}
