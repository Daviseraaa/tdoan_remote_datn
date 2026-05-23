import type { WfGraphEdge, WfNodeData } from './types';
import { WF_TRIGGER_ID } from './types';

export type UpstreamOutputKey = { nodeId: string; key: string; label: string };

function slugOutputKey(s: string): string {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return t.length ? t.slice(0, 48) : '';
}

export function resolveNodeOutputKey(data: WfNodeData, nodeId: string): string {
  const custom = data.config.outputKey?.trim();
  if (custom) return slugOutputKey(custom) || custom.replace(/\s+/g, '_');
  const fromTitle = slugOutputKey(data.config.title ?? data.label ?? '');
  if (fromTitle) return fromTitle;
  return slugOutputKey(nodeId) || nodeId.slice(0, 48);
}

export function getUpstreamStepKeys(
  nodeId: string,
  edges: WfGraphEdge[],
  nodes: { id: string; data: WfNodeData }[],
): UpstreamOutputKey[] {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const list = incoming.get(e.target) ?? [];
    list.push(e.source);
    incoming.set(e.target, list);
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: UpstreamOutputKey[] = [];
  const queue = [...(incoming.get(nodeId) ?? [])];

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id) || id === WF_TRIGGER_ID) continue;
    seen.add(id);

    const node = byId.get(id);
    if (node && node.data.kind !== 'trigger') {
      const key = resolveNodeOutputKey(node.data, id);
      out.push({ nodeId: id, key, label: node.data.label || key });
    }

    for (const p of incoming.get(id) ?? []) {
      if (!seen.has(p)) queue.push(p);
    }
  }

  return out;
}
