import type { Edge, Node } from '@xyflow/react';
import type {
  TaskType,
  Workflow,
  WorkflowStep,
  WorkflowStepConfig,
} from '@/src/types/api';
import { t } from '@/src/i18n/t';
import { normalizeWorkflowGraph } from './legacy';
import {
  buildFlowEdge,
  computeGraphPositions,
  isValidSavedLayout,
  resolvePosition,
} from './layout';
import {
  WF_HANDLE_DEFAULT,
  WF_TRIGGER_ID,
  WF_TRIGGER_KEY,
  type WfGraphEdge,
  type WfNodeData,
  type WfRunStatus,
  type WorkflowGraphV2,
} from './types';

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

export function stepLabel(step: WorkflowStep, config: WorkflowStepConfig): string {
  if (config.title?.trim()) return config.title.trim();
  if (step.type === 'DELAY') {
    return t('workflows.nodeDelay', { ms: config.delayMs ?? 1000 });
  }
  if (step.type === 'CONDITION') {
    return t('workflows.nodeCondition');
  }
  const tt = config.taskType ?? (step.type === 'SCRIPT' ? 'SCRIPT' : 'COMMAND');
  if (config.command?.trim()) return config.command.trim().slice(0, 48);
  return t(`taskType.${tt}` as 'taskType.COMMAND');
}

function nodeDisplayLabel(step: WorkflowStep, config: WorkflowStepConfig): string {
  if (config.title?.trim()) return config.title.trim();
  return stepLabel(step, config);
}

/** v2 + stepKey → runtime edges (node id = stepKey). */
export function graphV2ToRuntimeEdges(
  steps: WorkflowStep[],
  graph: WorkflowGraphV2,
): WfGraphEdge[] {
  const keyToId = new Map<string, string>();
  keyToId.set(WF_TRIGGER_KEY, WF_TRIGGER_ID);
  for (const s of steps) {
    const key = parseConfig(s.config).stepKey ?? s.id ?? `step-${s.order}`;
    if (key) keyToId.set(key, key);
  }

  const out: WfGraphEdge[] = [];
  for (const e of graph.edges) {
    const src = keyToId.get(e.from);
    const tgt = keyToId.get(e.to);
    if (!src || !tgt) continue;
    out.push({
      source: src,
      target: tgt,
      sourceHandle:
        e.handle === 'true' || e.handle === 'false' ? e.handle : undefined,
    });
  }
  return out;
}

function storedEdgesToFlow(stored: WfGraphEdge[]): Edge[] {
  return stored.map((e, i) => {
    const handle = e.sourceHandle ?? WF_HANDLE_DEFAULT;
    return buildFlowEdge(
      `e-v2-${i}-${e.source}-${e.target}-${handle}`,
      e.source,
      e.target,
      handle === WF_HANDLE_DEFAULT ? undefined : handle,
    );
  });
}

export function workflowToFlow(
  wf: Workflow,
  runStatusByStepId?: Record<string, WfRunStatus>,
): { nodes: Node<WfNodeData>[]; edges: Edge[] } {
  const steps = [...(wf.steps ?? [])].sort((a, b) => a.order - b.order);
  const graphV2 = normalizeWorkflowGraph(wf);

  const runtimeEdges = graphV2?.edges.length
    ? graphV2ToRuntimeEdges(steps, graphV2)
    : [];

  const orderFallback = new Map(
    steps.map((s) => {
      const key = parseConfig(s.config).stepKey ?? s.id ?? `step-${s.order}`;
      return [key, s.order];
    }),
  );

  const stepIds = steps.map(
    (s) => parseConfig(s.config).stepKey ?? s.id ?? `step-${s.order}`,
  );

  const graphForLayout =
    runtimeEdges.length > 0
      ? runtimeEdges
      : [];

  const useAutoLayout = !isValidSavedLayout(steps);
  const autoPositions = computeGraphPositions(stepIds, graphForLayout, orderFallback);

  const nodes: Node<WfNodeData>[] = [
    {
      id: WF_TRIGGER_ID,
      type: 'wfNode',
      deletable: false,
      selectable: true,
      draggable: false,
      position: autoPositions.get(WF_TRIGGER_ID) ?? { x: 48, y: 240 },
      data: {
        kind: 'trigger',
        label: t('workflows.manualTrigger'),
        stepType: 'COMMAND',
        config: {},
        onFailure: 'STOP',
        runStatus: 'idle',
      },
    },
  ];

  steps.forEach((step, i) => {
    const parsed = parseConfig(step.config);
    const stepKey = parsed.stepKey ?? step.id ?? `step-${step.order}`;
    const config: WorkflowStepConfig = {
      ...parsed,
      stepKey,
      graphEdges: undefined,
    };
    const id = stepKey;
    const position = resolvePosition(id, config, autoPositions, useAutoLayout, i);

    if (step.type === 'DELAY') {
      nodes.push({
        id,
        type: 'wfNode',
        position,
        data: {
          kind: 'delay',
          label: nodeDisplayLabel(step, config),
          stepType: 'DELAY',
          config,
          onFailure: step.onFailure ?? 'STOP',
          runStatus: runStatusByStepId?.[id] ?? 'idle',
        },
      });
      return;
    }

    if (step.type === 'CONDITION') {
      nodes.push({
        id,
        type: 'wfNode',
        position,
        data: {
          kind: 'condition',
          label: nodeDisplayLabel(step, config),
          stepType: 'CONDITION',
          config,
          onFailure: step.onFailure ?? 'STOP',
          runStatus: runStatusByStepId?.[id] ?? 'idle',
        },
      });
      return;
    }

    if (step.type === 'TELEGRAM') {
      nodes.push({
        id,
        type: 'wfNode',
        position,
        data: {
          kind: 'telegram',
          label: nodeDisplayLabel(step, config),
          stepType: 'TELEGRAM',
          config,
          onFailure: step.onFailure ?? 'STOP',
          runStatus: runStatusByStepId?.[id] ?? 'idle',
        },
      });
      return;
    }

    const taskType =
      config.taskType ?? (step.type === 'SCRIPT' ? 'SCRIPT' : 'COMMAND');

    nodes.push({
      id,
      type: 'wfNode',
      position,
      data: {
        kind: 'task',
        label: nodeDisplayLabel(step, config),
        stepType: step.type,
        taskType,
        config,
        onFailure: step.onFailure ?? 'STOP',
        runStatus: runStatusByStepId?.[id] ?? 'idle',
      },
    });
  });

  const edges = runtimeEdges.length ? storedEdgesToFlow(runtimeEdges) : [];

  return { nodes, edges };
}

export function workflowGraphFingerprint(wf: Workflow): string {
  const g = normalizeWorkflowGraph(wf);
  return `${wf.updatedAt ?? ''}|${JSON.stringify(g)}`;
}
