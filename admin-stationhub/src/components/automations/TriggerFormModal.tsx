import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import * as triggersApi from '@/src/api/triggers';
import type { ScheduleKind, WorkflowTrigger, WorkflowTriggerType } from '@/src/api/triggers';
import {
  buildPatchPayload,
  buildTriggerPayload,
  parseMatchConfig,
  SCHEDULE_KINDS,
  TELEGRAM_EVENTS,
} from '@/src/lib/triggerForm';
import { apiErrorMessage } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm';

type WorkflowOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  workflows: WorkflowOption[];
  /** null = create */
  editId?: string | null;
};

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function applyTriggerToForm(tr: WorkflowTrigger, setters: {
  setTriggerType: (v: WorkflowTriggerType) => void;
  setWorkflowId: (v: string) => void;
  setName: (v: string) => void;
  setEnabled: (v: boolean) => void;
  setTimezone: (v: string) => void;
  setScheduleKind: (v: ScheduleKind) => void;
  setCronExpression: (v: string) => void;
  setIntervalMinutes: (v: number) => void;
  setDailyHour: (v: number) => void;
  setDailyMinute: (v: number) => void;
  setRunAtLocal: (v: string) => void;
  setTelegramBotId: (v: string) => void;
  setCommandsText: (v: string) => void;
  setTelegramEvents: (v: string[]) => void;
}) {
  setters.setTriggerType(tr.type);
  setters.setWorkflowId(tr.workflow.id);
  setters.setName(tr.name ?? '');
  setters.setEnabled(tr.enabled);
  setters.setTimezone(tr.timezone ?? 'Asia/Ho_Chi_Minh');
  if (tr.scheduleKind) setters.setScheduleKind(tr.scheduleKind);
  if (tr.cronExpression) setters.setCronExpression(tr.cronExpression);
  if (tr.intervalSeconds) setters.setIntervalMinutes(Math.round(tr.intervalSeconds / 60));
  if (tr.dailyHour != null) setters.setDailyHour(tr.dailyHour);
  if (tr.dailyMinute != null) setters.setDailyMinute(tr.dailyMinute);
  setters.setRunAtLocal(toDatetimeLocal(tr.runAt));
  if (tr.telegramBotId) setters.setTelegramBotId(tr.telegramBotId);
  const mc = parseMatchConfig(tr.matchConfig);
  if (mc.commands?.length) setters.setCommandsText(mc.commands.join(', '));
  if (mc.events?.length) setters.setTelegramEvents(mc.events);
}

export function TriggerFormModal({ open, onClose, workflows, editId }: Props) {
  const qc = useQueryClient();
  const isEdit = Boolean(editId);
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>('SCHEDULE');
  const [workflowId, setWorkflowId] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('DAILY');
  const [cronExpression, setCronExpression] = useState('0 8 * * *');
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [dailyHour, setDailyHour] = useState(8);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [runAtLocal, setRunAtLocal] = useState('');
  const [telegramBotId, setTelegramBotId] = useState('');
  const [createNewBot, setCreateNewBot] = useState(false);
  const [botName, setBotName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [commandsText, setCommandsText] = useState('/run');
  const [telegramEvents, setTelegramEvents] = useState<string[]>([
    'message',
    'command',
    'callback_query',
  ]);
  const [error, setError] = useState<string | null>(null);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['workflow-trigger', editId],
    queryFn: () => triggersApi.getTrigger(editId!),
    enabled: open && !!editId,
  });

  const { data: bots } = useQuery({
    queryKey: ['telegram-bots'],
    queryFn: () => triggersApi.listTelegramBots(),
    enabled: open && triggerType === 'TELEGRAM',
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setCreateNewBot(false);
    if (!editId) {
      if (!workflowId && workflows[0]) setWorkflowId(workflows[0].id);
      return;
    }
  }, [open, editId, workflowId, workflows]);

  useEffect(() => {
    if (!existing || !editId) return;
    applyTriggerToForm(existing, {
      setTriggerType,
      setWorkflowId,
      setName,
      setEnabled,
      setTimezone,
      setScheduleKind,
      setCronExpression,
      setIntervalMinutes,
      setDailyHour,
      setDailyMinute,
      setRunAtLocal,
      setTelegramBotId,
      setCommandsText,
      setTelegramEvents,
    });
  }, [existing, editId]);

  useEffect(() => {
    if (bots?.length && !telegramBotId && !createNewBot && !isEdit) {
      setTelegramBotId(bots[0].id);
    }
  }, [bots, telegramBotId, createNewBot, isEdit]);

  const formOpts = () => ({
    type: triggerType,
    workflowId,
    name,
    enabled,
    timezone,
    scheduleKind,
    cronExpression,
    intervalMinutes,
    dailyHour,
    dailyMinute,
    runAtLocal,
    telegramBotId,
    commandsText,
    telegramEvents,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!isEdit && !workflowId) throw new Error(t('triggers.errWorkflow'));

      let botId = telegramBotId;
      if (!isEdit && triggerType === 'TELEGRAM' && createNewBot) {
        if (!botName.trim() || !botToken.trim()) throw new Error(t('triggers.errBotFields'));
        const bot = await triggersApi.createTelegramBot({
          name: botName.trim(),
          botToken: botToken.trim(),
        });
        botId = bot.id;
        await qc.invalidateQueries({ queryKey: ['telegram-bots'] });
      }
      if (triggerType === 'TELEGRAM' && !botId) {
        throw new Error(t('triggers.errBotRequired'));
      }

      if (isEdit && editId) {
        return triggersApi.patchTrigger(editId, buildPatchPayload(formOpts()));
      }
      return triggersApi.createTrigger(buildTriggerPayload(formOpts()));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['workflow-triggers'] });
      if (editId) await qc.invalidateQueries({ queryKey: ['workflow-trigger', editId] });
      onClose();
    },
    onError: (err: unknown) => setError(apiErrorMessage(err)),
  });

  const toggleEvent = (ev: string) => {
    setTelegramEvents((prev) =>
      prev.includes(ev) ? prev.filter((x) => x !== ev) : [...prev, ev],
    );
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card bg-surface rounded-3xl p-8 border border-white/10 custom-scrollbar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-2xl font-bold text-on-surface">
              {isEdit ? t('triggers.editTitle') : t('triggers.addTitle')}
            </h3>
            <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center">
              <X size={18} />
            </button>
          </div>

          {loadingExisting && isEdit ? (
            <p className="text-sm text-on-surface-variant flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> {t('automations.loading')}
            </p>
          ) : (
            <TriggerFormFields
              isEdit={isEdit}
              triggerType={triggerType}
              setTriggerType={setTriggerType}
              workflowId={workflowId}
              setWorkflowId={setWorkflowId}
              workflows={workflows}
              name={name}
              setName={setName}
              enabled={enabled}
              setEnabled={setEnabled}
              timezone={timezone}
              setTimezone={setTimezone}
              scheduleKind={scheduleKind}
              setScheduleKind={setScheduleKind}
              cronExpression={cronExpression}
              setCronExpression={setCronExpression}
              intervalMinutes={intervalMinutes}
              setIntervalMinutes={setIntervalMinutes}
              dailyHour={dailyHour}
              setDailyHour={setDailyHour}
              dailyMinute={dailyMinute}
              setDailyMinute={setDailyMinute}
              runAtLocal={runAtLocal}
              setRunAtLocal={setRunAtLocal}
              createNewBot={createNewBot}
              setCreateNewBot={setCreateNewBot}
              botName={botName}
              setBotName={setBotName}
              botToken={botToken}
              setBotToken={setBotToken}
              telegramBotId={telegramBotId}
              setTelegramBotId={setTelegramBotId}
              bots={bots}
              commandsText={commandsText}
              setCommandsText={setCommandsText}
              telegramEvents={telegramEvents}
              toggleEvent={toggleEvent}
              error={error}
            />
          )}

          <div className="flex gap-3 mt-8">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm">
              {t('common.cancel')}
            </button>
            <button
              type="button"
              disabled={saveMut.isPending || (isEdit && loadingExisting)}
              onClick={() => saveMut.mutate()}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saveMut.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              {isEdit ? t('common.save') : t('triggers.addSubmit')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

type FieldsProps = {
  isEdit: boolean;
  triggerType: WorkflowTriggerType;
  setTriggerType: (v: WorkflowTriggerType) => void;
  workflowId: string;
  setWorkflowId: (v: string) => void;
  workflows: WorkflowOption[];
  name: string;
  setName: (v: string) => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  scheduleKind: ScheduleKind;
  setScheduleKind: (v: ScheduleKind) => void;
  cronExpression: string;
  setCronExpression: (v: string) => void;
  intervalMinutes: number;
  setIntervalMinutes: (v: number) => void;
  dailyHour: number;
  setDailyHour: (v: number) => void;
  dailyMinute: number;
  setDailyMinute: (v: number) => void;
  runAtLocal: string;
  setRunAtLocal: (v: string) => void;
  createNewBot: boolean;
  setCreateNewBot: (v: boolean) => void;
  botName: string;
  setBotName: (v: string) => void;
  botToken: string;
  setBotToken: (v: string) => void;
  telegramBotId: string;
  setTelegramBotId: (v: string) => void;
  bots?: triggersApi.TelegramBot[];
  commandsText: string;
  setCommandsText: (v: string) => void;
  telegramEvents: string[];
  toggleEvent: (ev: string) => void;
  error: string | null;
};

function TriggerFormFields(p: FieldsProps) {
  return (
    <div className="space-y-4">
      <Field label={t('triggers.fieldType')}>
        <select
          value={p.triggerType}
          disabled={p.isEdit}
          onChange={(e) => p.setTriggerType(e.target.value as WorkflowTriggerType)}
          className={cn(inputCls, p.isEdit && 'opacity-60')}
        >
          <option value="SCHEDULE">{t('triggers.typeSchedule')}</option>
          <option value="TELEGRAM">{t('triggers.typeTelegram')}</option>
        </select>
      </Field>

      <Field label={t('triggers.colWorkflow')}>
        <select
          value={p.workflowId}
          disabled={p.isEdit}
          onChange={(e) => p.setWorkflowId(e.target.value)}
          className={cn(inputCls, p.isEdit && 'opacity-60')}
        >
          <option value="">{t('triggers.selectWorkflow')}</option>
          {p.workflows.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </Field>

      <Field label={t('triggers.fieldName')}>
        <input value={p.name} onChange={(e) => p.setName(e.target.value)} placeholder={t('triggers.fieldNamePlaceholder')} className={inputCls} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.enabled} onChange={(e) => p.setEnabled(e.target.checked)} />
        {t('triggers.fieldEnabled')}
      </label>

      {p.triggerType === 'SCHEDULE' ? (
        <>
          <Field label={t('triggers.fieldScheduleKind')}>
            <select value={p.scheduleKind} onChange={(e) => p.setScheduleKind(e.target.value as ScheduleKind)} className={inputCls}>
              {SCHEDULE_KINDS.map((k) => (
                <option key={k} value={k}>{t(`triggers.scheduleKind_${k}` as 'triggers.scheduleKind_DAILY')}</option>
              ))}
            </select>
          </Field>
          <Field label={t('triggers.fieldTimezone')}>
            <input value={p.timezone} onChange={(e) => p.setTimezone(e.target.value)} className={cn(inputCls, 'font-mono')} />
          </Field>
          {p.scheduleKind === 'CRON' ? (
            <Field label={t('workflows.cronExpression')}>
              <input value={p.cronExpression} onChange={(e) => p.setCronExpression(e.target.value)} className={cn(inputCls, 'font-mono')} />
            </Field>
          ) : null}
          {p.scheduleKind === 'INTERVAL' ? (
            <Field label={t('triggers.fieldIntervalMinutes')}>
              <input type="number" min={1} value={p.intervalMinutes} onChange={(e) => p.setIntervalMinutes(Number(e.target.value))} className={inputCls} />
            </Field>
          ) : null}
          {p.scheduleKind === 'DAILY' ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('triggers.fieldHour')}>
                <input type="number" min={0} max={23} value={p.dailyHour} onChange={(e) => p.setDailyHour(Number(e.target.value))} className={inputCls} />
              </Field>
              <Field label={t('triggers.fieldMinute')}>
                <input type="number" min={0} max={59} value={p.dailyMinute} onChange={(e) => p.setDailyMinute(Number(e.target.value))} className={inputCls} />
              </Field>
            </div>
          ) : null}
          {p.scheduleKind === 'ONCE' ? (
            <Field label={t('triggers.fieldRunAt')}>
              <input type="datetime-local" value={p.runAtLocal} onChange={(e) => p.setRunAtLocal(e.target.value)} className={inputCls} />
            </Field>
          ) : null}
        </>
      ) : null}

      {p.triggerType === 'TELEGRAM' ? (
        <>
          {!p.isEdit ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.createNewBot} onChange={(e) => p.setCreateNewBot(e.target.checked)} />
              {t('triggers.createNewBot')}
            </label>
          ) : null}
          {!p.isEdit && p.createNewBot ? (
            <>
              <Field label={t('triggers.botName')}><input value={p.botName} onChange={(e) => p.setBotName(e.target.value)} className={inputCls} /></Field>
              <Field label={t('triggers.botToken')}><input value={p.botToken} onChange={(e) => p.setBotToken(e.target.value)} type="password" className={cn(inputCls, 'font-mono')} /></Field>
              <p className="text-[10px] text-on-surface-variant">{t('triggers.botsSectionDesc')}</p>
            </>
          ) : (
            <Field label={t('triggers.selectBot')}>
              <select value={p.telegramBotId} onChange={(e) => p.setTelegramBotId(e.target.value)} className={inputCls}>
                <option value="">{t('triggers.noBots')}</option>
                {(p.bots ?? []).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.botUsername ? ` (@${b.botUsername})` : ''}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('triggers.fieldCommands')}>
            <input value={p.commandsText} onChange={(e) => p.setCommandsText(e.target.value)} className={cn(inputCls, 'font-mono')} />
            <p className="text-[10px] text-on-surface-variant mt-1">{t('triggers.fieldCommandsHint')}</p>
          </Field>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">{t('triggers.fieldEvents')}</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {TELEGRAM_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs cursor-pointer">
                  <input type="checkbox" checked={p.telegramEvents.includes(ev)} onChange={() => p.toggleEvent(ev)} />
                  {ev}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {p.error ? <p className="text-sm text-error font-medium">{p.error}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">{label}</label>
      {children}
    </div>
  );
}
