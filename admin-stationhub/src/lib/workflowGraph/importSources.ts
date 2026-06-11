import type {
  TaskTemplate,
  Workflow,
  WorkflowStep,
  WorkflowStepConfig,
  WorkflowStepType,
} from '@/src/types/api';
import {
  chromeStepsFromTaskTemplate,
  desktopStepsFromTaskTemplate,
} from '@/src/lib/taskTemplatePayload';
import { parseStepsFromJson as parseChromeStepsFromJson } from '@/src/lib/chromeScriptSteps';
import { parseStepsFromJson as parseDesktopStepsFromJson } from '@/src/lib/desktopRecordingSteps';
import { t } from '@/src/i18n/t';
import type { BuiltWorkflowNode } from './chromeScriptImport';
import { buildWorkflowNodesFromChromeScript } from './chromeScriptImport';
import { buildWorkflowNodesFromDesktopRecording } from './desktopRecordingImport';

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

function stepDisplayLabel(step: WorkflowStep, config: WorkflowStepConfig): string {
  if (config.title?.trim()) return config.title.trim();
  if (step.type === 'DELAY') {
    return t('workflows.nodeDelay', { ms: config.delayMs ?? 1000 });
  }
  if (step.type === 'CONDITION') return t('workflows.nodeCondition');
  if (step.type === 'LOOP') {
    return t('workflows.nodeLoop', { count: config.loopCount ?? 3 });
  }
  if (step.type === 'VARIABLE') {
    const mode = config.variableMode ?? 'set';
    if (mode === 'create') return t('workflows.nodeVarCreate');
    if (mode === 'read') return t('workflows.nodeVarRead');
    return t('workflows.nodeVarSet');
  }
  if (step.type === 'EXCEL') {
    return (config.excelMode ?? 'read') === 'read'
      ? t('workflows.nodeExcelRead')
      : t('workflows.nodeExcelWrite');
  }
  if (step.type === 'TELEGRAM') return t('workflows.nodeTelegram');
  const tt = config.taskType ?? (step.type === 'SCRIPT' ? 'SCRIPT' : 'COMMAND');
  if (config.command?.trim()) return config.command.trim().slice(0, 48);
  return t(`taskType.${tt}` as 'taskType.COMMAND');
}

export function workflowStepToBuiltNode(
  step: WorkflowStep,
  defaultAgentId: string,
): BuiltWorkflowNode {
  const stepKey = crypto.randomUUID();
  const parsed = parseConfig(step.config);
  const config: WorkflowStepConfig = {
    ...parsed,
    stepKey,
    agentId: parsed.agentId || defaultAgentId,
    graphEdges: undefined,
    ui: undefined,
  };

  if (step.type === 'DELAY') {
    return {
      stepKey,
      data: {
        kind: 'delay',
        label: stepDisplayLabel(step, config),
        stepType: 'DELAY',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  if (step.type === 'CONDITION') {
    return {
      stepKey,
      data: {
        kind: 'condition',
        label: stepDisplayLabel(step, config),
        stepType: 'CONDITION',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  if (step.type === 'LOOP') {
    return {
      stepKey,
      data: {
        kind: 'loop',
        label: stepDisplayLabel(step, config),
        stepType: 'LOOP',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  if (step.type === 'VARIABLE') {
    return {
      stepKey,
      data: {
        kind: 'variable',
        label: stepDisplayLabel(step, config),
        stepType: 'VARIABLE',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  if (step.type === 'EXCEL') {
    return {
      stepKey,
      data: {
        kind: 'excel',
        label: stepDisplayLabel(step, config),
        stepType: 'EXCEL',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  if (step.type === 'TELEGRAM') {
    return {
      stepKey,
      data: {
        kind: 'telegram',
        label: stepDisplayLabel(step, config),
        stepType: 'TELEGRAM',
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: 'idle',
      },
    };
  }

  const taskType =
    config.taskType ?? (step.type === 'SCRIPT' ? 'SCRIPT' : 'COMMAND');

  return {
    stepKey,
    data: {
      kind: 'task',
      label: stepDisplayLabel(step, config),
      stepType: step.type as WorkflowStepType,
      taskType,
      config,
      onFailure: step.onFailure ?? 'STOP',
      runStatus: 'idle',
    },
  };
}

export function buildWorkflowNodesFromWorkflow(
  workflow: Workflow,
  defaultAgentId: string,
): BuiltWorkflowNode[] {
  const steps = [...(workflow.steps ?? [])].sort((a, b) => a.order - b.order);
  return steps.map((step) => workflowStepToBuiltNode(step, defaultAgentId));
}

export function buildWorkflowNodesFromTaskTemplate(
  template: TaskTemplate,
  defaultAgentId: string,
): BuiltWorkflowNode[] {
  const agentId = template.agentId || defaultAgentId;

  if (template.type === 'CHROME_EXTENSION') {
    const { steps, urlPattern } = chromeStepsFromTaskTemplate(template);
    if (steps.length > 0) {
      return buildWorkflowNodesFromChromeScript(
        {
          id: template.id,
          name: template.name,
          startUrl: urlPattern || null,
          steps,
          source: 'template',
          userId: template.userId,
          agentId,
          createdAt: template.createdAt ?? '',
          updatedAt: template.updatedAt ?? '',
        },
        agentId,
      );
    }
  }

  if (template.type === 'DESKTOP_AUTOMATION') {
    const steps = desktopStepsFromTaskTemplate(template);
    if (steps.length > 0) {
      return buildWorkflowNodesFromDesktopRecording(
        {
          id: template.id,
          name: template.name,
          steps,
          source: 'template',
          userId: template.userId,
          agentId,
          createdAt: template.createdAt ?? '',
          updatedAt: template.updatedAt ?? '',
        },
        agentId,
      );
    }
  }

  return [workflowStepToBuiltNode(
    {
      order: 1,
      type: template.type === 'SCRIPT' ? 'SCRIPT' : 'COMMAND',
      config: {
        agentId,
        taskType: template.type,
        command: template.command,
        payload: template.payload ?? undefined,
        timeout: template.timeout,
        title: template.name,
      },
      onFailure: 'STOP',
    },
    agentId,
  )];
}

export function chromeStepsFromWorkflow(workflow: Workflow): {
  steps: ReturnType<typeof parseChromeStepsFromJson>;
  urlPattern: string;
} {
  const built = buildWorkflowNodesFromWorkflow(workflow, '');
  const steps: ReturnType<typeof parseChromeStepsFromJson> = [];
  let urlPattern = '';

  for (const { data } of built) {
    if (data.kind === 'delay') {
      const ms = data.config.delayMs ?? 500;
      steps.push({ id: crypto.randomUUID(), action: 'delay', ms });
      continue;
    }
    if (data.kind !== 'task' || data.taskType !== 'CHROME_EXTENSION') continue;

    const cfg = data.config;
    const payload = cfg.payload as Record<string, unknown> | undefined;
    if (payload?.urlPattern && !urlPattern) urlPattern = String(payload.urlPattern);

    const cmd = (cfg.command ?? '').trim();
    if (cmd.startsWith('[') || cmd.startsWith('{')) {
      try {
        const parsed = JSON.parse(cmd) as unknown;
        const raw = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown[] }).steps)
            ? (parsed as { steps: unknown[] }).steps
            : [];
        steps.push(
          ...parseChromeStepsFromJson(raw).map((s) => ({ ...s, id: crypto.randomUUID() })),
        );
        continue;
      } catch {
        /* fall through */
      }
    }

    if (payload?.action) {
      steps.push({
        id: crypto.randomUUID(),
        action: String(payload.action) as import('@/src/lib/chromeScriptSteps').ChromeScriptAction,
        selector: typeof payload.selector === 'string' ? payload.selector : undefined,
        text: typeof payload.text === 'string' ? payload.text : undefined,
        ms: typeof payload.ms === 'number' ? payload.ms : undefined,
        maxNodes: typeof payload.maxNodes === 'number' ? payload.maxNodes : undefined,
        timeoutMs: typeof payload.timeoutMs === 'number' ? payload.timeoutMs : undefined,
      });
    }
  }

  return { steps, urlPattern };
}

export function desktopStepsFromWorkflow(workflow: Workflow): ReturnType<typeof parseDesktopStepsFromJson> {
  const built = buildWorkflowNodesFromWorkflow(workflow, '');
  const steps: ReturnType<typeof parseDesktopStepsFromJson> = [];

  for (const { data } of built) {
    if (data.kind === 'delay') {
      steps.push({ id: crypto.randomUUID(), action: 'delay', ms: data.config.delayMs ?? 500 });
      continue;
    }
    if (data.kind !== 'task' || data.taskType !== 'DESKTOP_AUTOMATION') continue;

    const payload = data.config.payload as { steps?: unknown[] } | undefined;
    if (Array.isArray(payload?.steps) && payload.steps.length > 0) {
      steps.push(
        ...parseDesktopStepsFromJson(payload.steps).map((s) => ({ ...s, id: crypto.randomUUID() })),
      );
      continue;
    }

    const cmd = (data.config.command ?? '').trim();
    if (cmd.startsWith('[') || cmd.startsWith('{')) {
      try {
        const parsed = JSON.parse(cmd) as unknown;
        const raw = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown[] }).steps)
            ? (parsed as { steps: unknown[] }).steps
            : [];
        steps.push(
          ...parseDesktopStepsFromJson(raw).map((s) => ({ ...s, id: crypto.randomUUID() })),
        );
      } catch {
        /* ignore */
      }
    }
  }

  return steps;
}

export type WfImportSource = 'task' | 'workflow' | 'desktopRecording' | 'chromeScript';

export function builtNodesFromImportSource(
  source: WfImportSource,
  item: TaskTemplate | Workflow | import('@/src/types/api').ChromeScript | import('@/src/types/api').DesktopRecording,
  defaultAgentId: string,
): BuiltWorkflowNode[] {
  switch (source) {
    case 'task':
      return buildWorkflowNodesFromTaskTemplate(item as TaskTemplate, defaultAgentId);
    case 'workflow':
      return buildWorkflowNodesFromWorkflow(item as Workflow, defaultAgentId);
    case 'chromeScript':
      return buildWorkflowNodesFromChromeScript(
        item as import('@/src/types/api').ChromeScript,
        defaultAgentId,
      );
    case 'desktopRecording':
      return buildWorkflowNodesFromDesktopRecording(
        item as import('@/src/types/api').DesktopRecording,
        defaultAgentId,
      );
    default:
      return [];
  }
}
