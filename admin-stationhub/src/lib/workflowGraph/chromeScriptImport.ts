import type { ChromeScript } from '@/src/types/api';
import {
  actionLabel,
  parseStepsFromJson,
  summarizeStep,
  type ChromeScriptStep,
} from '@/src/lib/chromeScriptSteps';
import { t } from '@/src/i18n/t';
import type { WfNodeData } from './types';

export type BuiltWorkflowNode = {
  stepKey: string;
  data: WfNodeData;
};

const NODE_X_SPACING = 300;

export function scriptUrlPattern(script: ChromeScript): string | undefined {
  const raw = script.startUrl?.trim();
  if (!raw) return undefined;
  return raw.endsWith('/') ? `${raw}*` : `${raw}*`;
}

function chromeStepLabel(
  step: ChromeScriptStep,
  index: number,
  scriptName: string,
): string {
  const action = actionLabel(step.action);
  const detail = summarizeStep(step);
  return `${scriptName} · ${index + 1}. ${action}: ${detail}`;
}

export function chromeScriptStepToWfNodeData(
  step: ChromeScriptStep,
  agentId: string,
  urlPattern: string | undefined,
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

  const payload: Record<string, unknown> = {
    action: step.action,
    maxNodes: step.maxNodes ?? 200,
  };
  if (urlPattern) payload.urlPattern = urlPattern;
  if (step.selector != null) payload.selector = step.selector;
  if (step.selectorIndex != null && step.selectorIndex > 0) {
    payload.selectorIndex = step.selectorIndex;
  }
  if (step.action === 'fill') payload.text = step.text ?? '';
  if (step.action === 'waitFor' && step.timeoutMs != null) {
    payload.timeoutMs = step.timeoutMs;
  }
  if (step.action === 'snapshotDom' && step.interactiveOnly != null) {
    payload.interactiveOnly = step.interactiveOnly;
  }

  const timeout =
    step.action === 'waitFor' ? (step.timeoutMs ?? 10_000) + 5_000 : 120_000;

  return {
    kind: 'task',
    label,
    stepType: 'COMMAND',
    taskType: 'CHROME_EXTENSION',
    config: {
      agentId,
      taskType: 'CHROME_EXTENSION',
      command: '[]',
      payload,
      title: label,
      timeout,
      stepKey,
    },
    onFailure: 'STOP',
    runStatus: 'idle',
  };
}

/** Mỗi bước script → một node workflow (delay → node DELAY, còn lại → CHROME_EXTENSION). */
export function buildWorkflowNodesFromChromeScript(
  script: ChromeScript,
  defaultAgentId: string,
): BuiltWorkflowNode[] {
  const steps = parseStepsFromJson(script.steps);
  if (steps.length === 0) return [];

  const agentId = script.agentId || defaultAgentId;
  const urlPattern = scriptUrlPattern(script);
  const scriptName = script.name?.trim() || 'Script';

  return steps.map((step, index) => {
    const stepKey = crypto.randomUUID();
    const label = chromeStepLabel(step, index, scriptName);
    return {
      stepKey,
      data: chromeScriptStepToWfNodeData(step, agentId, urlPattern, label, stepKey),
    };
  });
}

export { NODE_X_SPACING };

export function isChromeReplayCommand(command?: string): boolean {
  const cmd = (command ?? '').trim();
  return cmd.startsWith('[') || cmd.startsWith('{');
}
