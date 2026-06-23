import dagre from 'dagre';
import {
  WF_HANDLE_BODY,
  WF_HANDLE_DEFAULT,
  WF_HANDLE_DONE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  WF_TRIGGER_ID,
  type WfGraphEdge,
} from './types';
import {
  WF_NODE_BODY_HEIGHT,
  WF_NODE_DAGRE_LAYOUT_WIDTH,
  WF_NODE_DAGRE_RANKSEP,
  WF_NODE_LAYOUT_GAP_Y,
  type WfLayoutNodeMeta,
} from './nodeLayout';

const TRIGGER_X = 48;
const H_BASE_Y = 240;

/** Không gian phía trên icon cho badge biến. */
const WF_NODE_BADGE_EXTRA_H = 22;

const HANDLE_ORDER: Record<string, number> = {
  [WF_HANDLE_TRUE]: 0,
  [WF_HANDLE_BODY]: 0,
  [WF_HANDLE_DEFAULT]: 100,
  default: 100,
  [WF_HANDLE_DONE]: 200,
  [WF_HANDLE_FALSE]: 300,
};

export function nodeLayoutDimensions(
  id: string,
  _nodeMeta?: Map<string, WfLayoutNodeMeta>,
): { width: number; height: number } {
  return {
    width: WF_NODE_DAGRE_LAYOUT_WIDTH,
    height: WF_NODE_BODY_HEIGHT + WF_NODE_BADGE_EXTRA_H,
  };
}

function incomingEdges(graphEdges: WfGraphEdge[]): Map<string, WfGraphEdge[]> {
  const inc = new Map<string, WfGraphEdge[]>();
  for (const e of graphEdges) {
    const list = inc.get(e.target) ?? [];
    list.push(e);
    inc.set(e.target, list);
  }
  return inc;
}

function nodeRankOrder(
  id: string,
  incoming: Map<string, WfGraphEdge[]>,
  orderFallback: Map<string, number>,
  stepIds: string[],
): number {
  const ins = incoming.get(id) ?? [];
  const base = (orderFallback.get(id) ?? stepIds.indexOf(id)) * 2;
  if (ins.length === 0) return base;

  let rank = Infinity;
  for (const e of ins) {
    const h = HANDLE_ORDER[e.sourceHandle ?? WF_HANDLE_DEFAULT] ?? 100;
    rank = Math.min(rank, h + base);
  }
  return rank === Infinity ? base : rank;
}

/**
 * Layout phân tầng bằng dagre (LR) — xử lý fork/merge, tránh chồng nhánh.
 * @see https://reactflow.dev/learn/layouting/layouting
 */
export function layoutWithDagre(
  stepIds: string[],
  graphEdges: WfGraphEdge[],
  orderFallback: Map<string, number>,
  nodeMeta?: Map<string, WfLayoutNodeMeta>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const allIds = [WF_TRIGGER_ID, ...stepIds];

  if (stepIds.length === 0) {
    positions.set(WF_TRIGGER_ID, { x: TRIGGER_X, y: H_BASE_Y });
    return positions;
  }

  const incoming = incomingEdges(graphEdges);
  const g = new dagre.graphlib.Graph({ compound: false, multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    align: 'UL',
    nodesep: WF_NODE_LAYOUT_GAP_Y + 10,
    ranksep: WF_NODE_DAGRE_RANKSEP,
    edgesep: 10,
    marginx: TRIGGER_X,
    marginy: 32,
    ranker: 'network-simplex',
  });

  for (const id of allIds) {
    const dim = nodeLayoutDimensions(id, nodeMeta);
    g.setNode(id, {
      width: dim.width,
      height: dim.height,
      order: nodeRankOrder(id, incoming, orderFallback, stepIds),
    });
  }

  const seenEdges = new Set<string>();
  for (const e of graphEdges) {
    if (!allIds.includes(e.source) || !allIds.includes(e.target)) continue;
    if (e.target === WF_TRIGGER_ID) continue;
    const edgeName = `${e.source}|${e.target}|${e.sourceHandle ?? 'd'}`;
    if (seenEdges.has(edgeName)) continue;
    seenEdges.add(edgeName);
    g.setEdge(
      e.source,
      e.target,
      { minlen: 1, weight: 1 },
      edgeName,
    );
  }

  dagre.layout(g);

  for (const id of allIds) {
    const laid = g.node(id) as { x: number; y: number } | undefined;
    if (!laid) continue;
    const dim = nodeLayoutDimensions(id, nodeMeta);
    positions.set(id, {
      x: laid.x - dim.width / 2,
      y: laid.y - dim.height / 2,
    });
  }

  const trigger = positions.get(WF_TRIGGER_ID);
  if (trigger) {
    const dx = TRIGGER_X - trigger.x;
    const dy = H_BASE_Y - trigger.y;
    for (const [id, p] of positions) {
      positions.set(id, { x: p.x + dx, y: p.y + dy });
    }
  }

  return positions;
}
