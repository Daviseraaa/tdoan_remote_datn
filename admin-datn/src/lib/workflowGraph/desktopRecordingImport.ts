import type { DesktopRecording } from '@/src/types/api';
import {
  actionLabel,
  parseStepsFromJson,
  summarizeStep,
  type DesktopStep,
} from '@/src/lib/desktopRecordingSteps';
import { serializeDesktopStep } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import type { WfNodeData } from './types';
import type { BuiltWorkflowNode } from './chromeScriptImport';

function desktopStepLabel(step: DesktopStep, index: number, recordingName: string): string {
  const action = actionLabel(step.action);
  const detail = summarizeStep(step);
  return `${recordingName} · ${index + 1}. ${action}: ${detail}`;
}

export function desktopRecordingStepToWfNodeData(
  step: DesktopStep,
  agentId: string,
  label: string,
  stepKey: string,
): WfNodeData {
  if (step.action === 'delay') {
    const ms = step.ms ?? 500;
    return {
      kind: 'delay',
      label: t('workflows.nodeDelay', { ms }),
      stepType: 'DELAY',
      config: { delayMs: ms, stepKey, title: label },
      onFailure: 'STOP',
      runStatus: 'idle',
    };
  }

  return {
    kind: 'task',
    label,
    stepType: 'COMMAND',
    taskType: 'DESKTOP_AUTOMATION',
    config: {
      agentId,
      taskType: 'DESKTOP_AUTOMATION',
      command: t('templateWizard.desktopStepCount', { count: '1' }),
      payload: { steps: [serializeDesktopStep(step)] },
      title: label,
      timeout: 300_000,
      stepKey,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

/** Mỗi bước recording → một node workflow (delay → DELAY, còn lại → DESKTOP_AUTOMATION). */
export function buildWorkflowNodesFromDesktopRecording(
  recording: DesktopRecording,
  defaultAgentId: string,
): BuiltWorkflowNode[] {
  const steps = parseStepsFromJson(recording.steps);
  if (steps.length === 0) return [];

  const agentId = recording.agentId || defaultAgentId;
  const recordingName = recording.name?.trim() || 'Recording';

  return steps.map((step, index) => {
    const stepKey = crypto.randomUUID();
    const label = desktopStepLabel(step, index, recordingName);
    return {
      stepKey,
      data: desktopRecordingStepToWfNodeData(step, agentId, label, stepKey),
    };
  });
}
