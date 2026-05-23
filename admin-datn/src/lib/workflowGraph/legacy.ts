import type { Workflow, WorkflowStep } from '@/src/types/api';
import {
  WF_TRIGGER_KEY,
  type WorkflowGraphV2,
  type WorkflowGraphV2Edge,
  isWorkflowGraphV2,
} from './types';

function parseConfig(raw: unknown): {
  stepKey?: string;
  graphEdges?: unknown[];
} {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as { stepKey?: string; graphEdges?: unknown[] };
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

function collectLegacyRaw(steps: WorkflowStep[]): unknown[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const step of sorted) {
    const edges = parseConfig(step.config).graphEdges;
    if (!edges?.length) continue;
    for (const item of edges) {
      const key = JSON.stringify(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function legacyRawToV2(steps: WorkflowStep[], raw: unknown[]): WorkflowGraphV2 {
  const orderToKey = new Map<number, string>();
  for (const s of steps) {
    const key = parseConfig(s.config).stepKey ?? s.id ?? `step-${s.order}`;
    orderToKey.set(s.order, key);
  }

  const edges: WorkflowGraphV2Edge[] = [];
  for (const item of raw) {
    const row = item as Record<string, unknown>;
    if (typeof row.sourceOrder === 'number' && typeof row.targetOrder === 'number') {
      const from =
        row.sourceOrder === 0 ? WF_TRIGGER_KEY : orderToKey.get(row.sourceOrder);
      const to = orderToKey.get(row.targetOrder);
      if (from && to) {
        edges.push({
          from,
          to,
          handle: row.sourceHandle as string | undefined,
        });
      }
    } else if (typeof row.source === 'string' && typeof row.target === 'string') {
      const from =
        row.source === '__trigger__' || row.source === WF_TRIGGER_KEY
          ? WF_TRIGGER_KEY
          : (row.source as string);
      const to = row.target as string;
      edges.push({
        from,
        to,
        handle: row.sourceHandle as string | undefined,
      });
    }
  }

  return { version: 2, edges: dedupeV2(edges) };
}

/** Lấy graph v2 từ workflow (ưu tiên graph, convert legacy). */
export function normalizeWorkflowGraph(wf: Workflow): WorkflowGraphV2 | null {
  if (isWorkflowGraphV2(wf.graph)) {
    return wf.graph;
  }

  const steps = [...(wf.steps ?? [])].sort((a, b) => a.order - b.order);
  let raw: unknown[] = [];
  if (Array.isArray(wf.graphEdges) && wf.graphEdges.length) {
    raw = wf.graphEdges as unknown[];
  } else {
    raw = collectLegacyRaw(steps);
  }

  if (!raw.length) return null;
  return legacyRawToV2(steps, raw);
}
