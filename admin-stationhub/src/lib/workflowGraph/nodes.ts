import type {
  TaskType,
  WorkflowExcelMode,
  WorkflowStepType,
  WorkflowVariableMode,
} from '@/src/types/api';
import { t } from '@/src/i18n/t';
import { DEFAULT_TELEGRAM_RECIPIENT } from '@/src/lib/telegramSendPayload';
import type { WfNodeData } from './types';
import { loopNodeLabel } from './loopLabel';

export function newTaskNodeData(
  taskType: TaskType,
  defaultAgentId: string,
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  const stepType: WorkflowStepType = taskType === 'SCRIPT' ? 'SCRIPT' : 'COMMAND';
  return {
    kind: 'task',
    label: t(`taskType.${taskType}` as 'taskType.COMMAND'),
    stepType,
    taskType,
    config: {
      agentId: defaultAgentId,
      taskType,
      command:
        taskType === 'SYSTEM_INFO'
          ? 'collect'
          : taskType === 'OPEN_BROWSER'
            ? 'https://example.com'
            : taskType === 'CHROME_EXTENSION'
              ? '[]'
              : taskType === 'SCREEN_CAPTURE'
                ? '0'
                : taskType === 'HTTP_REQUEST'
                  ? 'https://example.com/api'
                  : taskType === 'CLOSE_APP'
                    ? 'close'
                    : taskType === 'FOCUS_APP'
                      ? 'focus'
                    : taskType === 'TELEGRAM_SEND'
                      ? 'send'
                      : '',
      payload:
        taskType === 'CLOSE_APP'
          ? { mode: 'openedInRun' }
          : taskType === 'FOCUS_APP'
            ? { mode: 'windowTitle', windowTitle: '' }
          : taskType === 'OPEN_BROWSER'
          ? { useChromeProfile: false }
          : taskType === 'CHROME_EXTENSION'
            ? { action: 'snapshotDom', maxNodes: 200 }
            : taskType === 'SCREEN_CAPTURE'
              ? {
                  monitor: 0,
                  includeBase64: false,
                  saveToFile: true,
                  sendTelegram: false,
                }
              : taskType === 'HTTP_REQUEST'
                ? { method: 'GET' }
                : taskType === 'TELEGRAM_SEND'
                  ? {
                      mode: 'message',
                      chatId: DEFAULT_TELEGRAM_RECIPIENT,
                    }
                  : undefined,
      timeout: 60000,
      priority: 5,
      stepKey,
      ui: position,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

export function newDelayNodeData(
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  return {
    kind: 'delay',
    label: t('workflows.nodeDelay', { ms: 1000 }),
    stepType: 'DELAY',
    config: { delayMs: 1000, stepKey, ui: position },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

export function newTelegramNodeData(
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  return {
    kind: 'telegram',
    label: t('workflows.nodeTelegram'),
    stepType: 'TELEGRAM',
    config: {
      action: 'send_message',
      chatId: DEFAULT_TELEGRAM_RECIPIENT,
      text: '{{steps.prev.stdout}}',
      stepKey,
      ui: position,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

export function newConditionNodeData(
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  return {
    kind: 'condition',
    label: t('workflows.nodeCondition'),
    stepType: 'CONDITION',
    config: {
      conditionMode: 'last_exit_success',
      conditionExitCode: 0,
      stepKey,
      ui: position,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

function variableNodeLabel(mode: WorkflowVariableMode): string {
  if (mode === 'create') return t('workflows.nodeVarCreate');
  if (mode === 'read') return t('workflows.nodeVarRead');
  return t('workflows.nodeVarSet');
}

export function newVariableNodeData(
  mode: WorkflowVariableMode,
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  return {
    kind: 'variable',
    label: variableNodeLabel(mode),
    stepType: 'VARIABLE',
    config: {
      variableMode: mode,
      variableValue: mode === 'read' ? undefined : '',
      stepKey,
      ui: position,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

function excelNodeLabel(mode: WorkflowExcelMode): string {
  if (mode === 'read') return t('workflows.nodeExcelRead');
  return t('workflows.nodeExcelWrite');
}

export function newExcelNodeData(
  mode: WorkflowExcelMode,
  defaultAgentId: string,
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  return {
    kind: 'excel',
    label: excelNodeLabel(mode),
    stepType: 'EXCEL',
    config: {
      excelMode: mode,
      sheetName: undefined,
      hasHeader: true,
      agentId: defaultAgentId,
      timeout: 120000,
      priority: 5,
      stepKey,
      ui: position,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

export function newLoopNodeData(
  position: { x: number; y: number },
  stepKey: string,
): WfNodeData {
  const loopCount = 3;
  const config = {
    loopMode: 'fixed' as const,
    loopCount,
    stepKey,
    ui: position,
  };
  return {
    kind: 'loop',
    label: loopNodeLabel(config),
    stepType: 'LOOP',
    config,
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}
