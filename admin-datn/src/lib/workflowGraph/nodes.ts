import type { TaskType, WorkflowStepType } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import type { WfNodeData } from './types';

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
                : '',
      payload:
        taskType === 'OPEN_BROWSER'
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
              : undefined,
      timeout: 60000,
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
      chatId: '{{telegram.chatId}}',
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
