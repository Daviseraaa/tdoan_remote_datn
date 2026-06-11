import { StepType } from '@prisma/client';

export interface WorkflowGraphEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

export const WF_TRIGGER_ID = '__trigger__';
export const HANDLE_TRUE = 'true';
export const HANDLE_FALSE = 'false';
export const HANDLE_BODY = 'body';
export const HANDLE_DONE = 'done';

export type GraphOutEdge = { targetId: string; handle: string };

export function buildAdjacency(
  graphEdges: WorkflowGraphEdge[],
): Map<string, GraphOutEdge[]> {
  const adj = new Map<string, GraphOutEdge[]>();
  for (const e of graphEdges) {
    const list = adj.get(e.source) ?? [];
    list.push({
      targetId: e.target,
      handle: e.sourceHandle ?? 'default',
    });
    adj.set(e.source, list);
  }
  return adj;
}

export function buildLoopBackEdgeKeys(
  steps: { id: string; type: StepType }[],
  stepIds: Set<string>,
  adj: Map<string, GraphOutEdge[]>,
): Set<string> {
  const loopIds = new Set(
    steps.filter((s) => s.type === StepType.LOOP).map((s) => s.id),
  );
  const keys = new Set<string>();
  for (const loopId of loopIds) {
    const bodyRoots = (adj.get(loopId) ?? [])
      .filter((o) => o.handle === HANDLE_BODY)
      .map((o) => o.targetId);
    const visited = new Set<string>();
    const queue = [...bodyRoots];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const o of adj.get(id) ?? []) {
        if (o.targetId === loopId) {
          keys.add(`${id}|${loopId}`);
        } else if (stepIds.has(o.targetId) && o.targetId !== loopId) {
          queue.push(o.targetId);
        }
      }
    }
  }
  return keys;
}

export function buildStepIndegree(
  stepIds: Set<string>,
  graphEdges: WorkflowGraphEdge[],
  loopBackEdgeKeys?: Set<string>,
): Map<string, number> {
  const indegree = new Map<string, number>();
  for (const id of stepIds) indegree.set(id, 0);
  for (const e of graphEdges) {
    if (
      stepIds.has(e.target) &&
      e.source !== WF_TRIGGER_ID &&
      stepIds.has(e.source)
    ) {
      const key = `${e.source}|${e.target}`;
      if (loopBackEdgeKeys?.has(key)) continue;
      indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
    }
  }
  return indegree;
}

export function getStartStepIds(
  steps: { id: string; order: number }[],
  adj: Map<string, GraphOutEdge[]>,
): string[] {
  const fromTrigger = (adj.get(WF_TRIGGER_ID) ?? []).map((e) => e.targetId);
  if (fromTrigger.length) return fromTrigger;

  const targets = new Set<string>();
  for (const outs of adj.values()) {
    for (const o of outs) targets.add(o.targetId);
  }
  const roots = steps
    .filter((s) => !targets.has(s.id))
    .sort((a, b) => a.order - b.order);
  if (roots.length) return roots.map((s) => s.id);
  return [...steps].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function filterOutEdges(
  step: { type: StepType },
  outs: GraphOutEdge[],
  branch?: string,
): GraphOutEdge[] {
  if (step.type === StepType.CONDITION) {
    const handle = branch === HANDLE_TRUE ? HANDLE_TRUE : HANDLE_FALSE;
    return outs.filter((o) => o.handle === handle);
  }
  if (step.type === StepType.LOOP) {
    const handle = branch === HANDLE_BODY ? HANDLE_BODY : HANDLE_DONE;
    return outs.filter((o) => o.handle === handle);
  }
  const filtered = outs.filter(
    (o) =>
      o.handle === 'default' ||
      (o.handle !== HANDLE_TRUE &&
        o.handle !== HANDLE_FALSE &&
        o.handle !== HANDLE_BODY &&
        o.handle !== HANDLE_DONE),
  );
  return filtered.length ? filtered : outs;
}
