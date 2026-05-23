import { Logger } from '@nestjs/common';
import {
  WF_TRIGGER_KEY,
  type WorkflowGraphEdge,
  type WorkflowGraphV2,
  type WorkflowGraphV2Edge,
  isWorkflowGraphV2,
} from './workflow-graph.types';

export { WF_TRIGGER_KEY, WorkflowGraphEdge, WorkflowGraphV2, WorkflowGraphV2Edge, isWorkflowGraphV2 };

const logger = new Logger('WorkflowGraph');

function parseConfig(raw: unknown): {
  stepKey?: string;
  graphEdges?: unknown[];
} {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as { stepKey?: string; graphEdges?: unknown[] };
  }
  return {};
}

function normalizeHandle(handle?: string): string | undefined {
  if (!handle || handle === 'default') return undefined;
  return handle;
}

function dedupe(edges: WorkflowGraphEdge[]): WorkflowGraphEdge[] {
  const seen = new Set<string>();
  const out: WorkflowGraphEdge[] = [];
  for (const e of edges) {
    const key = `${e.source}|${e.target}|${e.sourceHandle ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function buildKeyToStepId(
  steps: { id: string; config: unknown }[],
): Map<string, string> {
  const map = new Map<string, string>();
  map.set(WF_TRIGGER_KEY, WF_TRIGGER_KEY);
  for (const s of steps) {
    const key = parseConfig(s.config).stepKey;
    if (key) map.set(key, s.id);
    else logger.warn(`Step ${s.id} missing config.stepKey — skipped in graph resolve`);
  }
  return map;
}

/** Resolve v2 graph (stepKey) → runtime edge (step id). */
export function resolveGraphV2(
  steps: { id: string; config: unknown }[],
  graph: WorkflowGraphV2,
): WorkflowGraphEdge[] {
  const keyToId = buildKeyToStepId(steps);
  const resolved: WorkflowGraphEdge[] = [];

  for (const e of graph.edges) {
    const src = keyToId.get(e.from);
    const tgt = keyToId.get(e.to);
    if (!src || !tgt) {
      logger.warn(`Graph edge ${e.from} -> ${e.to}: unknown stepKey, skipped`);
      continue;
    }
    resolved.push({
      source: src,
      target: tgt,
      sourceHandle: normalizeHandle(e.handle),
    });
  }

  return dedupe(resolved);
}

/** Legacy order/id edges → v2 (for migration). */
export function legacyRawToGraphV2(
  steps: { id: string; order: number; config: unknown }[],
  raw: unknown[],
): WorkflowGraphV2 {
  const orderToKey = new Map<number, string>();
  for (const s of steps) {
    const key = parseConfig(s.config).stepKey ?? s.id;
    orderToKey.set(s.order, key);
  }

  const edges: WorkflowGraphV2Edge[] = [];
  for (const item of raw) {
    const row = item as Record<string, unknown>;
    if (typeof row.sourceOrder === 'number' && typeof row.targetOrder === 'number') {
      const from =
        row.sourceOrder === 0
          ? WF_TRIGGER_KEY
          : orderToKey.get(row.sourceOrder);
      const to = orderToKey.get(row.targetOrder);
      if (from && to) {
        edges.push({
          from,
          to,
          handle: row.sourceHandle as string | undefined,
        });
      }
      continue;
    }
    if (typeof row.source === 'string' && typeof row.target === 'string') {
      const from =
        row.source === WF_TRIGGER_KEY || row.source === '__trigger__'
          ? WF_TRIGGER_KEY
          : parseConfig(
              steps.find((s) => s.id === row.source)?.config ?? {},
            ).stepKey ?? (row.source as string);
      const toStep = steps.find((s) => s.id === row.target);
      const to =
        parseConfig(toStep?.config ?? {}).stepKey ?? (row.target as string);
      if (from && to) {
        edges.push({
          from,
          to,
          handle: row.sourceHandle as string | undefined,
        });
      }
    }
  }

  return { version: 2, edges: dedupeV2Edges(edges) };
}

function dedupeV2Edges(edges: WorkflowGraphV2Edge[]): WorkflowGraphV2Edge[] {
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

function collectLegacyRaw(
  steps: { order: number; config: unknown }[],
): unknown[] {
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

/** Chuẩn hóa graph từ workflow (v2 ưu tiên, legacy convert). */
export function normalizeWorkflowGraph(
  steps: { id: string; order: number; config: unknown }[],
  graph?: unknown,
  graphEdges?: unknown,
): WorkflowGraphV2 | null {
  if (isWorkflowGraphV2(graph)) {
    return graph;
  }

  let raw: unknown[] = [];
  if (Array.isArray(graphEdges) && graphEdges.length) {
    raw = graphEdges;
  } else {
    raw = collectLegacyRaw(steps);
  }

  if (!raw.length) return null;
  return legacyRawToGraphV2(steps, raw);
}

/** Resolve edges cho executeGraph / engine. */
export function resolveWorkflowGraphEdges(
  steps: { id: string; order: number; config: unknown }[],
  graph?: unknown,
  graphEdgesLegacy?: unknown,
): WorkflowGraphEdge[] {
  if (!steps.length) return [];

  const v2 = normalizeWorkflowGraph(steps, graph, graphEdgesLegacy);
  if (!v2?.edges.length) return [];

  return resolveGraphV2(steps, v2);
}

/** Strip graph khỏi step config trước khi lưu DB. */
export function sanitizeStepConfig(config: Record<string, unknown>): Record<string, unknown> {
  const { graphEdges: _ge, ...rest } = config;
  return rest;
}
