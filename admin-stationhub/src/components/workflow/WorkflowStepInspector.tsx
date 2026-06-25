import type {
  Agent,
  ChromeScript,
  DesktopRecording,
  TaskTemplate,
  TaskType,
  Workflow,
  WorkflowConditionMode,
  WorkflowLoopMode,
  WorkflowStepOnFailure,
} from '@/src/types/api';
import { VAR_CONDITION_MODES, isVarConditionMode } from '@/src/types/api';
import { Trash2 } from 'lucide-react';
import type { WfNodeData } from '@/src/lib/workflowGraph';
import { WF_TRIGGER_ID } from '@/src/lib/workflowGraph';
import { isWorkflowEditorEditableTarget } from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import { WfAgentSelect } from './WfAgentSelect';
import { WfInspectorBlock } from './WfInspectorLayout';
import { WfStepVarsSection } from './WfStepVarsSection';
import { WfWorkflowVariablesEditorSection, WfNodeExportSection } from './WfVarsInspectorFooter';
import { WfNodeExportFields } from './WfNodeExportFields';
import {
  nodeExportsStepVariables,
  nodePublishesWorkflowVar,
  workflowVarNameInputValue,
  loopNodeLabel,
} from '@/src/lib/workflowGraph';
import {
  ScreenCaptureOptionsFields,
  type ScreenCapturePayload,
} from './ScreenCaptureOptionsFields';
import { OpenBrowserConfigFields } from './OpenBrowserConfigFields';
import { CloseAppConfigFields } from './CloseAppConfigFields';
import { FocusAppConfigFields } from './FocusAppConfigFields';
import { TelegramSendConfigFields } from './TelegramSendConfigFields';
import { HttpRequestConfigFields } from './HttpRequestConfigFields';
import { WfOpenAppConfigFields } from './WfOpenAppConfigFields';
import { WfSystemInfoConfigFields } from './WfSystemInfoConfigFields';
import { WfShellCommandConfigFields } from './WfShellCommandConfigFields';
import { WfExcelConfigFields } from './WfExcelConfigFields';
import { WfChromeExtensionConfigFields } from './WfChromeExtensionConfigFields';
import { WfDesktopAutomationConfigFields } from './WfDesktopAutomationConfigFields';
import { WfTelegramNodeConfigFields } from './WfTelegramNodeConfigFields';
import { WfTaskTimingFields } from './WfTaskTimingFields';
import { buildOpenAppTaskConfig, parseOpenAppForm, type OpenAppMode } from '@/src/lib/taskTemplatePayload';
import { isChromeReplayCommand, isChromePayloadStepMode, desktopStepsFromWfPayload } from '@/src/lib/workflowGraph';
import { WfImportMenu } from './WfImportMenu';
import { MsNumberInput } from './MsNumberInput';
import {
  WfChromeImportedStepFields,
  WfDesktopImportedStepFields,
} from './WfImportedRecordingStepFields';

const ON_FAILURE: WorkflowStepOnFailure[] = ['STOP', 'SKIP', 'RETRY'];

const CONDITION_MODES: WorkflowConditionMode[] = [
  'last_exit_success',
  'last_exit_failed',
  'last_exit_code_eq',
  ...VAR_CONDITION_MODES,
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
  onDelete?: () => void;
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
  onDelete,
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

  const openAppForm =
    data.taskType === 'OPEN_APP'
      ? parseOpenAppForm(cfg.command, cfg.payload, cfg.openAppMode as OpenAppMode | undefined)
      : null;

  const chromeReplayMode = isChromeReplayCommand(cfg.command, cfg.payload);
  const chromePayloadStepMode = isChromePayloadStepMode(cfg.payload);
  const desktopPayloadSteps = desktopStepsFromWfPayload(cfg.payload);

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
    <div
      className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar min-w-0 w-full"
      onKeyDownCapture={(e) => {
        if (isWorkflowEditorEditableTarget(e.target)) e.stopPropagation();
      }}
      onKeyUpCapture={(e) => {
        if (isWorkflowEditorEditableTarget(e.target)) e.stopPropagation();
      }}
    >
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
        <WfTelegramNodeConfigFields config={cfg} onPatch={patchConfig} />
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
          {isVarConditionMode(cfg.conditionMode as WorkflowConditionMode) ? (
            <>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.conditionVariable')}
                </label>
                <input
                  value={workflowVarNameInputValue('variable', cfg.conditionVariable)}
                  onChange={(e) => patchConfig({ conditionVariable: e.target.value.trim() })}
                  placeholder={t('workflows.conditionVariablePlaceholder')}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                />
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  {t('workflows.conditionVariableHint')}
                </p>
              </div>
              {cfg.conditionMode !== 'var_empty' && cfg.conditionMode !== 'var_not_empty' ? (
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                    {t('workflows.conditionCompareValue')}
                  </label>
                  <input
                    value={cfg.conditionCompareValue ?? ''}
                    onChange={(e) => patchConfig({ conditionCompareValue: e.target.value })}
                    placeholder={t('workflows.conditionCompareValuePlaceholder')}
                    className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                  />
                </div>
              ) : null}
            </>
          ) : null}
          <p className="text-[10px] text-on-surface-variant/70">{t('workflows.conditionHint')}</p>
        </>
      ) : data.kind === 'loop' ? (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.loopMode')}
            </label>
            <select
              value={(cfg.loopMode as WorkflowLoopMode) ?? 'fixed'}
              onChange={(e) => {
                const loopMode = e.target.value as WorkflowLoopMode;
                onUpdate({
                  label: loopNodeLabel({ ...cfg, loopMode }),
                  config: { ...cfg, loopMode },
                });
              }}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
            >
              <option value="fixed">{t('workflows.loopMode_fixed')}</option>
              <option value="variable">{t('workflows.loopMode_variable')}</option>
              <option value="array">{t('workflows.loopMode_array')}</option>
            </select>
          </div>
          {(cfg.loopMode ?? 'fixed') === 'variable' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('workflows.loopCountVar')}
              </label>
              <input
                value={workflowVarNameInputValue('variable', cfg.loopCountVar)}
                onChange={(e) => {
                  const loopCountVar = e.target.value.trim();
                  onUpdate({
                    label: loopNodeLabel({ ...cfg, loopMode: 'variable', loopCountVar }),
                    config: { ...cfg, loopMode: 'variable', loopCountVar },
                  });
                }}
                placeholder={t('workflows.loopCountVarPlaceholder')}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
              />
              <p className="text-[10px] text-on-surface-variant/70 mt-1">
                {t('workflows.loopCountVarHint')}
              </p>
            </div>
          ) : (cfg.loopMode ?? 'fixed') === 'array' ? (
            <>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.loopArrayVar')}
                </label>
                <input
                  value={workflowVarNameInputValue('variable', cfg.loopArrayVar)}
                  onChange={(e) => {
                    const loopArrayVar = e.target.value.trim();
                    onUpdate({
                      label: loopNodeLabel({ ...cfg, loopMode: 'array', loopArrayVar }),
                      config: { ...cfg, loopMode: 'array', loopArrayVar },
                    });
                  }}
                  placeholder={t('workflows.loopArrayVarPlaceholder')}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                />
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  {t('workflows.loopArrayVarHint')}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.loopItemVar')}
                </label>
                <input
                  value={cfg.loopItemVar ?? ''}
                  onChange={(e) => {
                    const loopItemVar = e.target.value.trim();
                    onUpdate({
                      config: { ...cfg, loopMode: 'array', loopItemVar: loopItemVar || undefined },
                    });
                  }}
                  placeholder={t('workflows.loopItemVarPlaceholder')}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
                />
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  {t('workflows.loopItemVarHint')}
                </p>
              </div>
            </>
          ) : (
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
                  onUpdate({
                    label: loopNodeLabel({ ...cfg, loopMode: 'fixed', loopCount: count }),
                    config: { ...cfg, loopMode: 'fixed', loopCount: count },
                  });
                }}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              />
            </div>
          )}
          <p className="text-[10px] text-on-surface-variant/70">{t('workflows.loopHint')}</p>
        </>
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
          <WfExcelConfigFields
            mode={cfg.excelMode ?? 'read'}
            agentId={cfg.agentId}
            agents={agents}
            filePath={cfg.filePath}
            sheetName={cfg.sheetName}
            hasHeader={cfg.hasHeader}
            variableName={cfg.variableName}
            variableValue={cfg.variableValue}
            onAgentChange={(agentId) => {
              patchConfig({ agentId });
              onAgentChange?.(agentId);
            }}
            onPatch={(p) => patchConfig(p)}
          />
          <WfTaskTimingFields
            timeout={cfg.timeout}
            priority={cfg.priority}
            onPatch={(p) => patchConfig(p)}
          />
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

          {data.taskType === 'SYSTEM_INFO' ? <WfSystemInfoConfigFields /> : null}

          {data.taskType === 'COMMAND' ? (
            <WfShellCommandConfigFields
              taskType="COMMAND"
              command={cfg.command ?? ''}
              agents={agents}
              agentId={cfg.agentId}
              onChange={(command) => patchConfig({ command })}
            />
          ) : null}

          {data.taskType === 'SCRIPT' ? (
            <WfShellCommandConfigFields
              taskType="SCRIPT"
              command={cfg.command ?? ''}
              agents={agents}
              agentId={cfg.agentId}
              onChange={(command) => patchConfig({ command })}
            />
          ) : null}

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

          {data.taskType === 'FOCUS_APP' ? (
            <FocusAppConfigFields
              compact
              payload={(cfg.payload as Record<string, unknown>) ?? {}}
              onChange={({ command, payload }) =>
                patchConfig({ command, payload, taskType: 'FOCUS_APP' })
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
          data.taskType !== 'COMMAND' &&
          data.taskType !== 'SCRIPT' &&
          data.taskType !== 'OPEN_APP' &&
          data.taskType !== 'FOCUS_APP' &&
          data.taskType !== 'CHROME_EXTENSION' &&
          data.taskType !== 'SCREEN_CAPTURE' &&
          data.taskType !== 'HTTP_REQUEST' &&
          data.taskType !== 'OPEN_BROWSER' &&
          data.taskType !== 'CLOSE_APP' &&
          data.taskType !== 'TELEGRAM_SEND' &&
          data.taskType !== 'DESKTOP_AUTOMATION' ? (
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

          {openAppForm ? (
            <WfOpenAppConfigFields
              mode={openAppForm.mode}
              value={openAppForm.value}
              reuseExisting={openAppForm.reuseExisting}
              maximizeWindow={openAppForm.maximizeWindow}
              onChange={(mode, value, reuseExisting, maximizeWindow) => {
                const built = buildOpenAppTaskConfig(mode, value, reuseExisting, maximizeWindow);
                patchConfig({
                  command: built.command,
                  payload: built.payload,
                  openAppMode: built.openAppMode,
                });
              }}
            />
          ) : null}

          {data.taskType === 'DESKTOP_AUTOMATION' && desktopPayloadSteps.length > 0 ? (
            <WfDesktopImportedStepFields
              payload={cfg.payload}
              onPatch={(p) => patchConfig(p)}
            />
          ) : data.taskType === 'DESKTOP_AUTOMATION' ? (
            <WfDesktopAutomationConfigFields
              command={cfg.command}
              payload={cfg.payload}
              onPatch={(p) => patchConfig(p)}
              onImportDesktopRecording={onImportDesktopRecording}
              onImportTaskTemplate={onImportTaskTemplate}
            />
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
              {chromePayloadStepMode ? (
                <WfChromeImportedStepFields
                  payload={cfg.payload}
                  command={cfg.command}
                  timeout={cfg.timeout}
                  onPatch={(p) => patchConfig(p)}
                />
              ) : null}
              {chromeReplayMode ? (
                <p className="text-[10px] text-primary/90 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                  {t('workflows.chromeExtensionReplayMode')}
                </p>
              ) : null}
              {!chromeReplayMode && !chromePayloadStepMode ? (
                <WfChromeExtensionConfigFields
                  payload={cfg.payload}
                  timeout={cfg.timeout}
                  onPatch={(p) => patchConfig(p)}
                />
              ) : null}
              {chromeReplayMode ? (
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('workflows.chromeExtensionStepsJson')}
                </label>
                <textarea
                  value={cfg.command ?? ''}
                  onChange={(e) => patchConfig({ command: e.target.value })}
                  rows={10}
                  placeholder={t('workflows.chromeExtensionStepsHint')}
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs"
                />
              </div>
              ) : !chromePayloadStepMode ? (
              <details className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                <summary className="text-[10px] font-mono font-bold uppercase text-on-surface-variant cursor-pointer">
                  {t('workflows.chromeExtensionAdvancedJson')}
                </summary>
                <p className="text-[10px] text-on-surface-variant mt-2 mb-2">
                  {t('workflows.chromeExtensionAdvancedJsonHint')}
                </p>
                <textarea
                  value={
                    (cfg.command ?? '').trim().startsWith('[') ||
                    (cfg.command ?? '').trim().startsWith('{')
                      ? (cfg.command ?? '')
                      : ''
                  }
                  onChange={(e) => patchConfig({ command: e.target.value })}
                  rows={5}
                  placeholder={t('workflows.chromeExtensionStepsHint')}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-white/10 font-mono text-xs"
                />
              </details>
              ) : null}
            </div>
          ) : null}

          <WfTaskTimingFields
            timeout={cfg.timeout}
            priority={cfg.priority}
            onPatch={(p) => patchConfig(p)}
          />
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
              {t(`workflows.onFailure_${v}` as 'workflows.onFailure_STOP')}
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

      {onDelete ? (
        <div className="pt-2 pb-1">
          <button
            type="button"
            onClick={onDelete}
            className="w-full py-3 rounded-xl border border-error/30 text-error font-bold text-sm flex items-center justify-center gap-2 hover:bg-error/10"
          >
            <Trash2 size={16} />
            {t('workflows.deleteNode')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
