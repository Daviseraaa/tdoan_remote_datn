import type { Workflow, WorkflowStep } from '@/src/types/api';
import { graphV2ToRuntimeEdges } from './deserialize';
import { normalizeWorkflowGraph } from './legacy';
import {
  WF_TRIGGER_ID,
  type WfGraphEdge,
  type WfRunStatus,
} from './types';

function parseConfig(raw: unknown): { stepKey?: string } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as { stepKey?: string };
  }
  return {};
}

export function stepRuntimeKey(step: WorkflowStep): string {
  const cfg = parseConfig(step.config);
  return cfg.stepKey ?? step.id ?? `step-${step.order}`;
}

function buildAdjacency(
  edges: WfGraphEdge[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  return adj;
}

function buildIndegree(
  stepKeys: Set<string>,
  edges: WfGraphEdge[],
): Map<string, number> {
  const indegree = new Map<string, number>();
  for (const k of stepKeys) indegree.set(k, 0);
  for (const e of edges) {
    if (
      stepKeys.has(e.target) &&
      e.source !== WF_TRIGGER_ID &&
      stepKeys.has(e.source)
    ) {
      indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    }
  }
  return indegree;
}

/** Sóng Kahn theo stepKey (khớp node id canvas); dùng hiển thị tiến độ khi execute đồng bộ. */
export function computeExecutionWaves(wf: Workflow): string[][] {
  const steps = [...(wf.steps ?? [])].sort((a, b) => a.order - b.order);
  if (!steps.length) return [];

  const graph = normalizeWorkflowGraph(wf);
  if (!graph?.edges.length) {
    return steps.map((s) => [stepRuntimeKey(s)]);
  }

  const edges = graphV2ToRuntimeEdges(steps, graph);
  const stepKeys = new Set(steps.map(stepRuntimeKey));
  const adj = buildAdjacency(edges);
  const pending = buildIndegree(stepKeys, edges);

  let ready = (adj.get(WF_TRIGGER_ID) ?? []).filter((k) => stepKeys.has(k));
  if (!ready.length) {
    const targets = new Set(edges.map((e) => e.target));
    ready = steps
      .filter((s) => !targets.has(stepRuntimeKey(s)))
      .map(stepRuntimeKey);
  }
  if (!ready.length) {
    return steps.map((s) => [stepRuntimeKey(s)]);
  }

  const waves: string[][] = [];
  while (ready.length) {
    waves.push([...ready]);
    const next: string[] = [];
    for (const key of ready) {
      for (const tgt of adj.get(key) ?? []) {
        if (!stepKeys.has(tgt)) continue;
        const left = (pending.get(tgt) ?? 0) - 1;
        pending.set(tgt, left);
        if (left <= 0) next.push(tgt);
      }
    }
    ready = next;
  }
  return waves;
}

export function buildWaveProgressStatusMap(
  waves: string[][],
  activeWaveIndex: number,
): Record<string, WfRunStatus> {
  const map: Record<string, WfRunStatus> = {};
  for (let w = 0; w < waves.length; w++) {
    for (const key of waves[w]) {
      if (w < activeWaveIndex) map[key] = 'completed';
      else if (w === activeWaveIndex) map[key] = 'running';
      else map[key] = 'pending';
    }
  }
  return map;
}

export function buildFinalRunStatusMap(
  wf: Workflow | null,
  result: { results: { step: number; stepId?: string; status: string }[] },
  waves?: string[][],
): Record<string, WfRunStatus> {
  const steps = [...(wf?.steps ?? [])].sort((a, b) => a.order - b.order);
  const keyByStepId = new Map(
    steps.filter((s) => s.id).map((s) => [s.id!, stepRuntimeKey(s)]),
  );
  const orderToKey = new Map(steps.map((s) => [s.order, stepRuntimeKey(s)]));

  const map: Record<string, WfRunStatus> = {};
  const touched = new Set<string>();

  for (const r of result.results) {
    const status: WfRunStatus =
      r.status === 'completed' ? 'completed' : 'failed';
    let key: string | undefined;
    if (r.stepId) key = keyByStepId.get(r.stepId);
    if (!key) key = orderToKey.get(r.step);
    if (key) {
      map[key] = status;
      touched.add(key);
    }
  }

  const allKeys = waves
    ? waves.flat()
    : steps.map(stepRuntimeKey);

  for (const key of allKeys) {
    if (!touched.has(key)) map[key] = 'skipped';
  }

  return map;
}
