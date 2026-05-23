import { Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type {
  Agent,
  TaskType,
  TelegramStepAction,
  WorkflowConditionMode,
  WorkflowStepOnFailure,
} from '@/src/types/api';
import type { WfNodeData } from '@/src/lib/workflowGraph';
import { WF_TRIGGER_ID } from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import { WfAgentSelect } from './WfAgentSelect';

const ON_FAILURE: WorkflowStepOnFailure[] = ['STOP', 'SKIP', 'RETRY'];

const CONDITION_MODES: WorkflowConditionMode[] = [
  'last_exit_success',
  'last_exit_failed',
  'last_exit_code_eq',
];

const TELEGRAM_ACTIONS: TelegramStepAction[] = [
  'send_message',
  'send_photo',
  'send_document',
  'reply_message',
  'edit_message',
  'inline_keyboard',
];

type Props = {
  nodeId: string | null;
  data: WfNodeData | null;
  agents: Agent[];
  upstreamOutputKeys?: { key: string; label: string }[];
  workflowVarKeys?: string[];
  onUpdate: (patch: Partial<WfNodeData> & { config?: WfNodeData['config'] }) => void;
  onDelete: () => void;
};

export function WorkflowStepInspector({
  nodeId,
  data,
  agents,
  upstreamOutputKeys = [],
  workflowVarKeys = [],
  onUpdate,
  onDelete,
}: Props) {
  if (!nodeId || !data || nodeId === WF_TRIGGER_ID || data.kind === 'trigger') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50 min-w-[360px]">
        <p className="text-sm font-bold">{t('workflows.selectNode')}</p>
        <p className="text-xs mt-2 text-on-surface-variant">{t('workflows.selectNodeHint')}</p>
      </div>
    );
  }

  const cfg = data.config;

  const patchConfig = (p: Partial<typeof cfg>) => {
    onUpdate({ config: { ...cfg, ...p } });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar min-w-[360px]">
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.nodeName')}
        </label>
        <input
          value={data.label}
          onChange={(e) =>
            onUpdate({
              label: e.target.value,
              config: { ...cfg, title: e.target.value },
            })
          }
          className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm font-bold"
        />
      </div>

      {data.kind === 'telegram' ? (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.telegramAction')}
            </label>
            <select
              value={(cfg.action as TelegramStepAction) ?? 'send_message'}
              onChange={(e) => patchConfig({ action: e.target.value as TelegramStepAction })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
            >
              {TELEGRAM_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.telegramBotId')}
            </label>
            <input
              value={cfg.telegramBotId ?? ''}
              onChange={(e) => patchConfig({ telegramBotId: e.target.value || undefined })}
              placeholder="uuid bot trong /triggers/telegram/bots"
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.telegramChatId')}
            </label>
            <input
              value={cfg.chatId ?? '{{telegram.chatId}}'}
              onChange={(e) => patchConfig({ chatId: e.target.value })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.telegramText')}
            </label>
            <textarea
              value={cfg.text ?? ''}
              onChange={(e) => patchConfig({ text: e.target.value })}
              rows={4}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
            />
            <p className="text-[10px] text-on-surface-variant mt-1">{t('workflows.commandVarsHint')}</p>
          </div>
        </>
      ) : null}

      {data.kind === 'condition' ? (
        <>
          <p className="text-xs text-on-surface-variant">{t('workflows.conditionHint')}</p>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.conditionMode')}
            </label>
            <select
              value={(cfg.conditionMode as WorkflowConditionMode) ?? 'last_exit_success'}
              onChange={(e) =>
                patchConfig({ conditionMode: e.target.value as WorkflowConditionMode })
              }
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
            >
              {CONDITION_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`workflows.conditionMode_${m}` as 'workflows.conditionMode_last_exit_success')}
                </option>
              ))}
            </select>
          </div>
          {(cfg.conditionMode ?? 'last_exit_success') === 'last_exit_code_eq' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.conditionMode_last_exit_code_eq')}
              </label>
              <input
                type="number"
                value={cfg.conditionExitCode ?? 0}
                onChange={(e) => patchConfig({ conditionExitCode: Number(e.target.value) })}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              />
            </div>
          ) : null}
        </>
      ) : data.kind === 'delay' ? (
        <div>
          <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('templateWizard.field_ms')}
          </label>
          <input
            type="number"
            min={0}
            value={cfg.delayMs ?? 1000}
            onChange={(e) => {
              const ms = Number(e.target.value);
              patchConfig({ delayMs: ms });
              onUpdate({ label: t('workflows.nodeDelay', { ms }) });
            }}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
          />
        </div>
      ) : data.kind === 'task' ? (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.outputKey')}
            </label>
            <input
              value={cfg.outputKey ?? ''}
              onChange={(e) => patchConfig({ outputKey: e.target.value || undefined })}
              placeholder={t('workflows.outputKeyPlaceholder')}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
            />
            <p className="text-[10px] text-on-surface-variant mt-1">{t('workflows.outputKeyHint')}</p>
          </div>

          {(upstreamOutputKeys.length > 0 || workflowVarKeys.length > 0) ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.varsAvailable')}
              </p>
              <p className="text-[10px] text-on-surface-variant">{t('workflows.varsHint')}</p>
              <ul className="text-[10px] font-mono space-y-1 text-primary/90">
                {workflowVarKeys.map((k) => (
                  <li key={`wf-${k}`}>{t('workflows.varPath_workflow').replace('<tên>', k)}</li>
                ))}
                {upstreamOutputKeys.map((u) => (
                  <li key={u.key}>
                    <span className="text-on-surface-variant">{u.label}: </span>
                    {`{{steps.${u.key}.stdout}}`}
                  </li>
                ))}
                {upstreamOutputKeys.length === 1 ? (
                  <li>{t('workflows.varPath_prev_stdout')}</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.agent')}
            </label>
            <WfAgentSelect
              value={cfg.agentId ?? ''}
              onChange={(id) => patchConfig({ agentId: id })}
              agents={agents}
              className="mt-1"
              placeholder={t('workflows.selectDefaultAgent')}
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('common.type')}
            </label>
            <p className="mt-1 text-sm font-mono text-primary">
              {t(`taskType.${data.taskType ?? 'COMMAND'}` as 'taskType.COMMAND')}
            </p>
          </div>

          {data.taskType !== 'SYSTEM_INFO' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.command')}
              </label>
              <textarea
                value={cfg.command ?? ''}
                onChange={(e) => patchConfig({ command: e.target.value })}
                rows={data.taskType === 'DESKTOP_AUTOMATION' ? 6 : 3}
                placeholder={
                  data.taskType === 'DESKTOP_AUTOMATION'
                    ? t('workflows.desktopStepsHint')
                    : t('templateWizard.commandPlaceholder')
                }
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
              />
              <p className="text-[10px] text-on-surface-variant mt-1">{t('workflows.commandVarsHint')}</p>
            </div>
          ) : null}

          {data.taskType === 'OPEN_APP' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.payloadJson')}
              </label>
              <textarea
                value={JSON.stringify(cfg.payload ?? {}, null, 2)}
                onChange={(e) => {
                  try {
                    patchConfig({ payload: JSON.parse(e.target.value) as Record<string, unknown> });
                  } catch {
                    /* ignore invalid json while typing */
                  }
                }}
                rows={4}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs"
              />
            </div>
          ) : null}

          {data.taskType === 'DESKTOP_AUTOMATION' ? (
            <p className="text-xs text-amber-400/90">{t('templateWizard.desktopBanner')}</p>
          ) : null}

          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.timeoutMs')}
            </label>
            <input
              type="number"
              min={5000}
              value={cfg.timeout ?? 60000}
              onChange={(e) => patchConfig({ timeout: Number(e.target.value) })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
            />
          </div>
        </>
      ) : null}

      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.onFailure')}
        </label>
        <select
          value={data.onFailure}
          onChange={(e) => onUpdate({ onFailure: e.target.value as WorkflowStepOnFailure })}
          className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
        >
          {ON_FAILURE.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={onDelete}
        className={cn(
          'w-full py-3 rounded-xl border border-error/30 text-error font-bold text-sm',
          'flex items-center justify-center gap-2 hover:bg-error/10',
        )}
      >
        <Trash2 size={16} />
        {t('workflows.deleteNode')}
      </button>
    </div>
  );
}
