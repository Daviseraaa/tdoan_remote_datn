import type { Edge, Node } from '@xyflow/react';
import type { WorkflowStep, WorkflowStepConfig } from '@/src/types/api';
import {
  WF_HANDLE_BODY,
  WF_HANDLE_DONE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  WF_TRIGGER_ID,
  WF_TRIGGER_KEY,
  type WfNodeData,
  type WorkflowGraphV2,
  type WorkflowGraphV2Edge,
} from './types';

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

function dedupeV2(edges: WorkflowGraphV2Edge[]): WorkflowGraphV2Edge[] {
  const seen = new Set<string>();
  const out: WorkflowGraphV2Edge[] = [];
  for (const e of edges) {
    const key = `${e.from}|${e.to}|${e.handle ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export function canvasToGraphV2(
  nodes: Node<WfNodeData>[],
  edges: Edge[],
): WorkflowGraphV2 {
  const stepIds = new Set(
    nodes.filter((n) => n.data.kind !== 'trigger').map((n) => n.id),
  );
  const v2: WorkflowGraphV2Edge[] = [];

  for (const e of edges) {
    if (!e.source || !e.target) continue;
    const from =
      e.source === WF_TRIGGER_ID ? WF_TRIGGER_KEY : e.source;
    const to = e.target;
    if (to === WF_TRIGGER_ID) continue;
    if (from !== WF_TRIGGER_KEY && !stepIds.has(from)) continue;
    if (!stepIds.has(to)) continue;

    const handle =
      e.sourceHandle === WF_HANDLE_TRUE ||
      e.sourceHandle === WF_HANDLE_FALSE ||
      e.sourceHandle === WF_HANDLE_BODY ||
      e.sourceHandle === WF_HANDLE_DONE
        ? e.sourceHandle
        : undefined;

    v2.push({ from, to, handle });
  }

  return { version: 2, edges: dedupeV2(v2) };
}

/** node.id = stepKey; gán stepKey nếu thiếu. */
export function ensureNodeStepKeys(nodes: Node<WfNodeData>[]): Node<WfNodeData>[] {
  return nodes.map((n) => {
    if (n.data.kind === 'trigger') return n;
    const cfg = parseConfig(n.data.config);
    const stepKey = cfg.stepKey ?? n.id;
    return {
      ...n,
      id: stepKey,
      data: {
        ...n.data,
        config: { ...cfg, stepKey },
      },
    };
  });
}

function buildStepFromNode(node: Node<WfNodeData>, order: number): WorkflowStep {
  const d = node.data;
  const parsed = parseConfig(d.config);
  const { graphEdges: _ge, stepOrder: _so, ...rest } = parsed;
  const stepKey = parsed.stepKey ?? node.id;
  const title = d.label?.trim() || rest.title || '';
  const baseConfig: WorkflowStepConfig = {
    ...rest,
    stepKey,
    title,
    ui: { x: node.position.x, y: node.position.y },
  };

  if (d.kind === 'delay') {
    return {
      id: node.id,
      order,
      type: 'DELAY',
      config: { ...baseConfig, delayMs: baseConfig.delayMs ?? 1000 },
      onFailure: d.onFailure,
    };
  }

  if (d.kind === 'condition') {
    return {
      id: node.id,
      order,
      type: 'CONDITION',
      config: {
        ...baseConfig,
        conditionMode: baseConfig.conditionMode ?? 'last_exit_success',
        conditionExitCode: baseConfig.conditionExitCode ?? 0,
      },
      onFailure: d.onFailure,
    };
  }

  if (d.kind === 'loop') {
    return {
      id: node.id,
      order,
      type: 'LOOP',
      config: {
        ...baseConfig,
        loopCount: baseConfig.loopCount ?? 3,
      },
      onFailure: d.onFailure,
    };
  }

  if (d.kind === 'variable') {
    return {
      id: node.id,
      order,
      type: 'VARIABLE',
      config: {
        ...baseConfig,
        variableMode: baseConfig.variableMode ?? 'set',
        variableName: baseConfig.variableName ?? 'my_var',
        variableValue: baseConfig.variableValue,
      },
      onFailure: d.onFailure,
    };
  }

  if (d.kind === 'excel') {
    return {
      id: node.id,
      order,
      type: 'EXCEL',
      config: {
        ...baseConfig,
        excelMode: baseConfig.excelMode ?? 'read',
        variableName: baseConfig.variableName ?? 'excel_data',
        filePath: baseConfig.filePath,
        sheetName: baseConfig.sheetName,
        hasHeader: baseConfig.hasHeader ?? true,
        agentId: baseConfig.agentId,
        variableValue: baseConfig.variableValue,
        timeout: baseConfig.timeout ?? 120000,
      },
      onFailure: d.onFailure,
    };
  }

  if (d.kind === 'telegram' || d.stepType === 'TELEGRAM') {
    return {
      id: node.id,
      order,
      type: 'TELEGRAM',
      config: baseConfig,
      onFailure: d.onFailure,
    };
  }

  const taskType = d.taskType ?? 'COMMAND';
  const stepType = taskType === 'SCRIPT' ? 'SCRIPT' : 'COMMAND';
  let config: WorkflowStepConfig = { ...baseConfig, taskType };

  if (taskType === 'CHROME_EXTENSION') {
    const pl =
      config.payload && typeof config.payload === 'object' && !Array.isArray(config.payload)
        ? ({ ...(config.payload as Record<string, unknown>) } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    if (typeof pl.action !== 'string') pl.action = 'snapshotDom';
    if (pl.maxNodes == null) pl.maxNodes = 200;
    const cmd = typeof config.command === 'string' ? config.command.trim() : '';
    const legacyAction =
      cmd === 'snapshotDom' || cmd === 'click' || cmd === 'fill' || cmd === 'waitFor' || cmd === 'delay';
    config = {
      ...config,
      payload: pl,
      command: cmd && !legacyAction && (cmd.startsWith('[') || cmd.startsWith('{')) ? cmd : '[]',
    };
  }

  return {
    id: node.id,
    order,
    type: stepType,
    config,
    onFailure: d.onFailure,
  };
}

export function flowToWorkflowPayload(
  nodes: Node<WfNodeData>[],
  edges: Edge[],
): { steps: WorkflowStep[]; graph: WorkflowGraphV2 } {
  const stepNodes = ensureNodeStepKeys(
    nodes.filter((n) => n.data.kind !== 'trigger') as Node<WfNodeData>[],
  );
  const graph = canvasToGraphV2(nodes, edges);
  const sorted = [...stepNodes].sort(
    (a, b) => (a.position.x ?? 0) - (b.position.x ?? 0),
  );
  const steps = sorted.map((node, index) => buildStepFromNode(node, index + 1));
  return { steps, graph };
}

export function flowToWorkflowSteps(
  nodes: Node<WfNodeData>[],
  edges: Edge[],
): WorkflowStep[] {
  return flowToWorkflowPayload(nodes, edges).steps;
}
