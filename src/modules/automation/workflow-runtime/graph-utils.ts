import { StepType } from '@prisma/client';

export interface WorkflowGraphEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

export const WF_TRIGGER_ID = '__trigger__';
const HANDLE_TRUE = 'true';
const HANDLE_FALSE = 'false';

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

export function buildStepIndegree(
  stepIds: Set<string>,
  graphEdges: WorkflowGraphEdge[],
): Map<string, number> {
  const indegree = new Map<string, number>();
  for (const id of stepIds) indegree.set(id, 0);
  for (const e of graphEdges) {
    if (
      stepIds.has(e.target) &&
      e.source !== WF_TRIGGER_ID &&
      stepIds.has(e.source)
    ) {
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
  const filtered = outs.filter(
    (o) =>
      o.handle === 'default' ||
      (o.handle !== HANDLE_TRUE && o.handle !== HANDLE_FALSE),
  );
  return filtered.length ? filtered : outs;
}
