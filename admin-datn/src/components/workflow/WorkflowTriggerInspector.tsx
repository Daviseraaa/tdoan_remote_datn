import { useState } from 'react';
import { CalendarClock, MessageCircle, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ScheduleKind, WorkflowTriggerType } from '@/src/api/triggers';
import {
  type EntryTriggerDraft,
  entryTriggerTypeSubtitle,
} from '@/src/lib/workflowEntryTrigger';
import { SCHEDULE_KINDS, TELEGRAM_EVENTS } from '@/src/lib/triggerForm';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm';

type Props = {
  draft: EntryTriggerDraft;
  workflowActive: boolean;
  onChange: (patch: Partial<EntryTriggerDraft>) => void;
  onNewBotChange?: (bot: { name: string; botToken: string } | null) => void;
};

const TRIGGER_TYPES: WorkflowTriggerType[] = ['MANUAL', 'SCHEDULE', 'TELEGRAM'];

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
        'flex-1 min-w-[72px] sm:min-w-[100px] flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl border text-center transition-all',
        active
          ? 'border-primary bg-primary/15 text-primary shadow-lg shadow-primary/10'
          : 'border-white/10 bg-white/[0.02] text-on-surface-variant hover:bg-white/5',
      )}
    >
      <Icon size={22} />
      <span className="text-xs font-bold">{entryTriggerTypeSubtitle(type)}</span>
    </button>
  );
}

export function WorkflowTriggerInspector({
  draft,
  workflowActive,
  onChange,
  onNewBotChange,
}: Props) {
  const [createNewBot, setCreateNewBot] = useState(false);
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');

  const syncNewBot = (create: boolean, name: string, token: string) => {
    if (!onNewBotChange) return;
    if (create && name.trim() && token.trim()) {
      onNewBotChange({ name: name.trim(), botToken: token.trim() });
    } else {
      onNewBotChange(null);
    }
  };

  const toggleEvent = (ev: string) => {
    const next = draft.telegramEvents.includes(ev)
      ? draft.telegramEvents.filter((x) => x !== ev)
      : [...draft.telegramEvents, ev];
    onChange({ telegramEvents: next });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar min-w-0 w-full">
      <div>
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">
          {t('workflows.triggerStartTitle')}
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {t('workflows.triggerStartHint')}
        </p>
      </div>

      {!workflowActive ? (
        <p className="text-xs text-error rounded-xl border border-error/30 bg-error/10 p-3">
          {t('triggers.workflowInactiveHint')}
        </p>
      ) : null}

      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-2">
          {t('workflows.triggerType')}
        </label>
        <div className="flex flex-wrap gap-2">
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
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.fieldName')}
            </label>
            <input
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t('triggers.fieldNamePlaceholder')}
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => onChange({ enabled: e.target.checked })}
            />
            {t('triggers.fieldEnabled')}
          </label>
        </>
      ) : (
        <p className="text-xs text-on-surface-variant rounded-xl border border-dashed border-white/10 p-4">
          {t('workflows.triggerManualDesc')}
        </p>
      )}

      {draft.type === 'SCHEDULE' ? (
        <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.fieldScheduleKind')}
            </label>
            <select
              value={draft.scheduleKind}
              onChange={(e) => onChange({ scheduleKind: e.target.value as ScheduleKind })}
              className={inputCls}
            >
              {SCHEDULE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`triggers.scheduleKind_${k}` as 'triggers.scheduleKind_DAILY')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.fieldTimezone')}
            </label>
            <input
              value={draft.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className={cn(inputCls, 'font-mono')}
            />
          </div>
          {draft.scheduleKind === 'CRON' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.cronExpression')}
              </label>
              <input
                value={draft.cronExpression}
                onChange={(e) => onChange({ cronExpression: e.target.value })}
                className={cn(inputCls, 'font-mono')}
              />
            </div>
          ) : null}
          {draft.scheduleKind === 'INTERVAL' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('triggers.fieldIntervalMinutes')}
              </label>
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
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('triggers.fieldHour')}
                </label>
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
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('triggers.fieldMinute')}
                </label>
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
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('triggers.fieldRunAt')}
              </label>
              <input
                type="datetime-local"
                value={draft.runAtLocal}
                onChange={(e) => onChange({ runAtLocal: e.target.value })}
                className={inputCls}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {draft.type === 'TELEGRAM' ? (
        <div className="space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={createNewBot}
              onChange={(e) => {
                const v = e.target.checked;
                setCreateNewBot(v);
                syncNewBot(v, botName, botToken);
              }}
            />
            {t('triggers.createNewBot')}
          </label>
          {createNewBot ? (
            <>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('triggers.botName')}
                </label>
                <input
                  value={botName}
                  onChange={(e) => {
                    setBotName(e.target.value);
                    syncNewBot(true, e.target.value, botToken);
                  }}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('triggers.botToken')}
                </label>
                <input
                  value={botToken}
                  onChange={(e) => {
                    setBotToken(e.target.value);
                    syncNewBot(true, botName, e.target.value);
                  }}
                  type="password"
                  className={cn(inputCls, 'font-mono')}
                />
              </div>
              <p className="text-[10px] text-on-surface-variant">{t('triggers.botsSectionDesc')}</p>
            </>
          ) : (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('triggers.selectBot')}
              </label>
              <WfTelegramBotSelect
                value={draft.telegramBotId}
                onChange={(id) => onChange({ telegramBotId: id })}
                autoSelectFirst={!draft.telegramBotId}
              />
            </div>
          )}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.fieldCommands')}
            </label>
            <input
              value={draft.commandsText}
              onChange={(e) => onChange({ commandsText: e.target.value })}
              className={cn(inputCls, 'font-mono')}
            />
            <p className="text-[10px] text-on-surface-variant mt-1">{t('triggers.fieldCommandsHint')}</p>
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.fieldEvents')}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TELEGRAM_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={draft.telegramEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-[11px] text-on-surface-variant">
        {t('workflows.triggerSaveHint')}{' '}
        <Link to="/automations" className="text-primary underline">
          {t('nav.automations')}
        </Link>
      </p>
    </div>
  );
}
