import type { WfGraphEdge, WfNodeData } from './types';
import { WF_TRIGGER_ID } from './types';
import {
  nodeExportsStepVariables,
  nodePublishesWorkflowVar,
  resolveStepOutputKey,
  resolveWorkflowVarName,
} from './variables';

export type UpstreamOutputKey = { nodeId: string; key: string; label: string };

function buildIncomingMap(edges: WfGraphEdge[]): Map<string, string[]> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const list = incoming.get(e.target) ?? [];
    list.push(e.source);
    incoming.set(e.target, list);
  }
  return incoming;
}

/** Tất cả node phía trước (theo cạnh ngược) — không gồm trigger. */
export function collectUpstreamNodeIds(nodeId: string, edges: WfGraphEdge[]): Set<string> {
  const incoming = buildIncomingMap(edges);
  const seen = new Set<string>();
  const queue = [...(incoming.get(nodeId) ?? [])];

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || id === WF_TRIGGER_ID) continue;
    seen.add(id);
    for (const p of incoming.get(id) ?? []) {
      if (!seen.has(p)) queue.push(p);
    }
  }

  return seen;
}

export function resolveNodeOutputKey(data: WfNodeData, nodeId: string): string {
  return resolveStepOutputKey(data.config, data.label, nodeId);
}

export function getUpstreamStepKeys(
  nodeId: string,
  edges: WfGraphEdge[],
  nodes: { id: string; data: WfNodeData }[],
): UpstreamOutputKey[] {
  const incoming = buildIncomingMap(edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: UpstreamOutputKey[] = [];
  const queue = [...(incoming.get(nodeId) ?? [])];

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || id === WF_TRIGGER_ID) continue;
    seen.add(id);

    const node = byId.get(id);
    if (node && nodeExportsStepVariables(node.data.kind, node.data.config)) {
      const key = resolveNodeOutputKey(node.data, id);
      out.push({ nodeId: id, key, label: node.data.label || key });
    }

    for (const p of incoming.get(id) ?? []) {
      if (!seen.has(p)) queue.push(p);
    }
  }

  return out;
}

/** Biến `workflow.*` khả dụng: biến khởi tạo + biến do node upstream publish (excel đọc, tạo/gán). */
export function getUpstreamWorkflowVarKeys(
  nodeId: string,
  edges: WfGraphEdge[],
  nodes: { id: string; data: WfNodeData }[],
  initialWorkflowVars?: Record<string, unknown>,
): string[] {
  const keys = new Set(Object.keys(initialWorkflowVars ?? {}));
  const upstreamIds = collectUpstreamNodeIds(nodeId, edges);

  for (const n of nodes) {
    if (!upstreamIds.has(n.id)) continue;
    const d = n.data;
    if (nodePublishesWorkflowVar(d.kind, d.config)) {
      keys.add(resolveWorkflowVarName(d.kind, d.config));
    }
  }

  return [...keys];
}
