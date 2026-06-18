import type {
  Agent,
  ChromeScript,
  DesktopRecording,
  TaskTemplate,
  TaskType,
  TelegramStepAction,
  Workflow,
  WorkflowConditionMode,
  WorkflowStepOnFailure,
} from '@/src/types/api';
import type { WfNodeData } from '@/src/lib/workflowGraph';
import { WF_TRIGGER_ID } from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import { WfAgentSelect } from './WfAgentSelect';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';
import { WfInspectorBlock } from './WfInspectorLayout';
import { WfStepVarsSection } from './WfStepVarsSection';
import { WfWorkflowVariablesEditorSection, WfNodeExportSection } from './WfVarsInspectorFooter';
import { WfNodeExportFields } from './WfNodeExportFields';
import {
  nodeExportsStepVariables,
  nodePublishesWorkflowVar,
  workflowVarNameInputValue,
} from '@/src/lib/workflowGraph';
import {
  ScreenCaptureOptionsFields,
  type ScreenCapturePayload,
} from './ScreenCaptureOptionsFields';
import { OpenBrowserConfigFields } from './OpenBrowserConfigFields';
import { CloseAppConfigFields } from './CloseAppConfigFields';
import { TelegramSendConfigFields } from './TelegramSendConfigFields';
import { HttpRequestConfigFields } from './HttpRequestConfigFields';
import { isChromeReplayCommand } from '@/src/lib/workflowGraph';
import { WfImportMenu } from './WfImportMenu';
import { MsNumberInput } from './MsNumberInput';

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
  workflowId?: string;
  workflowVariables?: Record<string, unknown>;
  onWorkflowVariablesChange?: (variables: Record<string, unknown>) => void;
  workflowStepDelayMs?: number;
  upstreamOutputKeys?: { key: string; label: string; nodeId?: string }[];
  workflowVarKeys?: string[];
  showTelegramVars?: boolean;
  onUpdate: (patch: Partial<WfNodeData> & { config?: WfNodeData['config'] }) => void;
  onAgentChange?: (agentId: string) => void;
  /** Thay node hiện tại + thêm các bước còn lại (khi đang chọn node Chrome). */
  onImportChromeScript?: (script: ChromeScript) => void;
  onImportDesktopRecording?: (recording: DesktopRecording) => void;
  onImportTaskTemplate?: (template: TaskTemplate) => void;
  onImportWorkflow?: (workflow: Workflow) => void;
};

export function WorkflowStepInspector({
  nodeId: inspectorNodeId,
  data,
  agents,
  workflowId,
  workflowVariables,
  onWorkflowVariablesChange,
  workflowStepDelayMs = 0,
  upstreamOutputKeys = [],
  workflowVarKeys = [],
  showTelegramVars = false,
  onUpdate,
  onAgentChange,
  onImportChromeScript,
  onImportDesktopRecording,
  onImportTaskTemplate,
  onImportWorkflow,
}: Props) {
  if (!inspectorNodeId || !data || inspectorNodeId === WF_TRIGGER_ID || data.kind === 'trigger') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center opacity-50 min-w-0 w-full">
        <p className="text-sm font-bold">{t('workflows.selectNode')}</p>
      </div>
    );
  }

  const cfg = data.config;

  const patchConfig = (p: Partial<typeof cfg>) => {
    onUpdate({ config: { ...cfg, ...p } });
  };

  const chromePayloadBase = (): Record<string, unknown> => {
    const p = (cfg.payload as Record<string, unknown> | undefined) ?? {};
    return {
      maxNodes: 200,
      ...p,
      action: typeof p.action === 'string' ? p.action : 'snapshotDom',
    };
  };

  const patchChromePayload = (patch: Record<string, unknown>) => {
    patchConfig({
      payload: { ...chromePayloadBase(), ...patch },
      command: '[]',
      taskType: 'CHROME_EXTENSION',
    });
  };

  const hasExport = Boolean(
    inspectorNodeId &&
      (nodeExportsStepVariables(data.kind, cfg) || nodePublishesWorkflowVar(data.kind, cfg)),
  );

  const exportFields = hasExport ? (
    <WfNodeExportFields
      nodeId={inspectorNodeId!}
      data={data}
      onPatchOutputKey={
        data.kind === 'task' ||
        (data.kind === 'variable' && (cfg.variableMode ?? 'set') === 'read')
          ? (outputKey) => patchConfig({ outputKey })
          : undefined
      }
      onPatchVariableName={
        (data.kind === 'excel' && (cfg.excelMode ?? 'read') === 'read') ||
        (data.kind === 'variable' &&
          ((cfg.variableMode ?? 'set') === 'create' || (cfg.variableMode ?? 'set') === 'set'))
          ? (variableName) => patchConfig({ variableName: variableName || undefined })
          : undefined
      }
    />
  ) : null;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar min-w-0 w-full">
      <WfWorkflowVariablesEditorSection
        workflowId={workflowId}
        workflowVariables={workflowVariables}
        onWorkflowVariablesChange={onWorkflowVariablesChange}
      />

      <WfInspectorBlock tone="properties">
        <div>
          <label className="text-[10px] font-mono font-bold uppercase text-amber-300/80">
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
            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-black/20 border border-amber-400/15 text-sm font-bold"
          />
        </div>
      </WfInspectorBlock>

      <WfInspectorBlock tone="config" className="space-y-4">
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
              {t('triggers.selectBot')}
            </label>
            <WfTelegramBotSelect
              value={cfg.telegramBotId ?? ''}
              onChange={(id) => patchConfig({ telegramBotId: id || undefined })}
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
          </div>
        </>
      ) : null}

      {data.kind === 'condition' ? (
        <>
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
      ) : data.kind === 'loop' ? (
        <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.loopCount')}
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={cfg.loopCount ?? 3}
              onChange={(e) => {
                const count = Math.max(1, Math.min(1000, Number(e.target.value) || 3));
                patchConfig({ loopCount: count });
                onUpdate({ label: t('workflows.nodeLoop', { count }) });
              }}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
            />
          </div>
      ) : data.kind === 'variable' ? (
        <>
          {(cfg.variableMode ?? 'set') === 'read' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.variableReadFrom')}
              </label>
              <input
                value={workflowVarNameInputValue('variable', cfg.variableName)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  patchConfig({ variableName: v || undefined });
                }}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                placeholder="my_var"
              />
            </div>
          ) : null}
          {(cfg.variableMode ?? 'set') !== 'read' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.variableValue')}
              </label>
              <textarea
                value={cfg.variableValue ?? ''}
                onChange={(e) => patchConfig({ variableValue: e.target.value })}
                rows={3}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                placeholder="{{steps.prev.stdout}}"
              />
            </div>
          ) : null}
        </>
      ) : data.kind === 'excel' ? (
        <>
          <WfAgentSelect
            agents={agents}
            value={cfg.agentId ?? ''}
            onChange={(agentId) => {
              patchConfig({ agentId });
              onAgentChange?.(agentId);
            }}
          />
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.excelFilePath')}
            </label>
            <input
              value={cfg.filePath ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                patchConfig({ filePath: v || undefined });
              }}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
              placeholder="C:\\data\\report.xlsx"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.excelSheet')}
            </label>
            <input
              value={
                !cfg.sheetName?.trim() || cfg.sheetName.trim() === 'Sheet1'
                  ? ''
                  : cfg.sheetName
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                patchConfig({ sheetName: v || undefined });
              }}
              placeholder="Sheet1"
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
            />
          </div>
          {(cfg.excelMode ?? 'read') === 'read' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cfg.hasHeader !== false}
                onChange={(e) => patchConfig({ hasHeader: e.target.checked })}
                className="rounded border-white/20"
              />
              {t('workflows.excelHasHeader')}
            </label>
          ) : null}
        </>
      ) : data.kind === 'delay' ? (
        <div>
          <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('templateWizard.field_ms')}
          </label>
          <MsNumberInput
            value={cfg.delayMs ?? 1000}
            onChange={(ms) => patchConfig({ delayMs: ms })}
            onCommitted={(ms) => onUpdate({ label: t('workflows.nodeDelay', { ms }) })}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
          />
        </div>
      ) : data.kind === 'task' ? (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.agent')}
            </label>
            <WfAgentSelect
              value={cfg.agentId ?? ''}
              onChange={(id) => {
                if (onAgentChange) onAgentChange(id);
                else patchConfig({ agentId: id });
              }}
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

          {data.taskType === 'HTTP_REQUEST' ? (
            <HttpRequestConfigFields config={cfg} onPatch={patchConfig} />
          ) : null}

          {data.taskType === 'OPEN_BROWSER' ? (
            <OpenBrowserConfigFields
              compact
              command={cfg.command ?? ''}
              payload={(cfg.payload as Record<string, unknown>) ?? {}}
              agentId={cfg.agentId}
              onChange={({ command, payload }) =>
                patchConfig({ command, payload, taskType: 'OPEN_BROWSER' })
              }
            />
          ) : null}

          {data.taskType === 'CLOSE_APP' ? (
            <CloseAppConfigFields
              compact
              payload={(cfg.payload as Record<string, unknown>) ?? {}}
              onChange={({ command, payload }) =>
                patchConfig({ command, payload, taskType: 'CLOSE_APP' })
              }
            />
          ) : null}

          {data.taskType === 'TELEGRAM_SEND' ? (
            <TelegramSendConfigFields
              compact
              payload={(cfg.payload as Record<string, unknown>) ?? {}}
              onChange={({ command, payload }) =>
                patchConfig({ command, payload, taskType: 'TELEGRAM_SEND' })
              }
            />
          ) : null}

          {data.taskType !== 'SYSTEM_INFO' &&
          data.taskType !== 'CHROME_EXTENSION' &&
          data.taskType !== 'SCREEN_CAPTURE' &&
          data.taskType !== 'HTTP_REQUEST' &&
          data.taskType !== 'OPEN_BROWSER' &&
          data.taskType !== 'CLOSE_APP' &&
          data.taskType !== 'TELEGRAM_SEND' ? (
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
            </div>
          ) : null}

          {data.taskType === 'SCREEN_CAPTURE' ? (
            <ScreenCaptureOptionsFields
              compact
              payload={(cfg.payload ?? {}) as ScreenCapturePayload}
              command={cfg.command}
              onChange={(next, cmd) =>
                patchConfig({
                  ...(cmd != null ? { command: cmd } : {}),
                  payload: next as typeof cfg.payload,
                })
              }
            />
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

          {data.taskType === 'CHROME_EXTENSION' ? (
            <div className="space-y-3">
              <WfImportMenu
                compact
                onImportChromeScript={(script) => onImportChromeScript?.(script)}
                onImportDesktopRecording={(rec) => onImportDesktopRecording?.(rec)}
                onImportTaskTemplate={(tpl) => onImportTaskTemplate?.(tpl)}
                onImportWorkflow={(wf) => onImportWorkflow?.(wf)}
              />
              {isChromeReplayCommand(cfg.command) ? (
                <p className="text-[10px] text-primary/90 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  {t('workflows.chromeExtensionReplayMode')}
                </p>
              ) : null}
              {!isChromeReplayCommand(cfg.command) ? (
              <>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.chromeExtensionAction')}
                </label>
                <select
                  value={String(chromePayloadBase().action ?? 'snapshotDom')}
                  onChange={(e) => patchChromePayload({ action: e.target.value })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                >
                  <option value="snapshotDom">snapshotDom</option>
                  <option value="click">click</option>
                  <option value="fill">fill</option>
                  <option value="waitFor">waitFor</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.chromeExtensionSelector')}
                </label>
                <input
                  type="text"
                  value={String(chromePayloadBase().selector ?? '')}
                  onChange={(e) => patchChromePayload({ selector: e.target.value })}
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                />
              </div>
              {chromePayloadBase().action === 'fill' ? (
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                    {t('workflows.chromeExtensionFillText')}
                  </label>
                  <input
                    type="text"
                    value={String(chromePayloadBase().text ?? '')}
                    onChange={(e) => patchChromePayload({ text: e.target.value })}
                    className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                  />
                </div>
              ) : null}
              </>
              ) : null}
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.chromeExtensionUrlPattern')}
                </label>
                <input
                  type="text"
                  value={String(chromePayloadBase().urlPattern ?? '')}
                  onChange={(e) => patchChromePayload({ urlPattern: e.target.value })}
                  placeholder="https://example.com/*"
                  className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {isChromeReplayCommand(cfg.command)
                    ? t('workflows.chromeExtensionStepsJson')
                    : t('workflows.chromeExtensionAdvancedJson')}
                </label>
                <textarea
                  value={
                    isChromeReplayCommand(cfg.command)
                      ? (cfg.command ?? '')
                      : (cfg.command ?? '').trim().startsWith('[') ||
                          (cfg.command ?? '').trim().startsWith('{')
                        ? (cfg.command ?? '')
                        : ''
                  }
                  onChange={(e) => patchConfig({ command: e.target.value })}
                  rows={isChromeReplayCommand(cfg.command) ? 10 : 5}
                  placeholder={t('workflows.chromeExtensionStepsHint')}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs"
                />
              </div>
            </div>
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

      {data.kind !== 'delay' ? (
        <div>
          <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('workflows.delayAfterStep')}
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={cfg.delayAfterMs ?? ''}
            placeholder={String(workflowStepDelayMs)}
            onChange={(e) => {
              const raw = e.target.value.trim();
              patchConfig({
                delayAfterMs: raw === '' ? undefined : Math.max(0, Number(raw) || 0),
              });
            }}
            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
          />
        </div>
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
      </WfInspectorBlock>

      <WfNodeExportSection exportContent={exportFields} hasExport={hasExport} />

      <WfInspectorBlock tone="vars">
        <WfStepVarsSection
          upstream={upstreamOutputKeys}
          workflowVarKeys={workflowVarKeys}
          showTelegramVars={showTelegramVars}
        />
      </WfInspectorBlock>
    </div>
  );
}
