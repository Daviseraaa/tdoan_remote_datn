import type { Edge, Node } from '@xyflow/react';
import { buildFlowEdge } from './layout';
import { WF_TRIGGER_ID, type WfNodeData } from './types';

const PASTE_OFFSET = { x: 48, y: 48 };

export type WfNodeClipboard = {
  originX: number;
  originY: number;
  nodes: Array<{
    relX: number;
    relY: number;
    data: WfNodeData;
  }>;
  edges: Array<{
    sourceIndex: number;
    targetIndex: number;
    sourceHandle?: string;
  }>;
};

function cloneNodeData(data: WfNodeData): WfNodeData {
  return JSON.parse(JSON.stringify(data)) as WfNodeData;
}

export function buildClipboardFromNodes(
  selectedNodes: Node<WfNodeData>[],
  edges: Edge[],
): WfNodeClipboard | null {
  const wfNodes = selectedNodes.filter((n) => n.id !== WF_TRIGGER_ID);
  if (wfNodes.length === 0) return null;

  const idSet = new Set(wfNodes.map((n) => n.id));
  const idToIndex = new Map(wfNodes.map((n, i) => [n.id, i]));

  const originX = Math.min(...wfNodes.map((n) => n.position.x));
  const originY = Math.min(...wfNodes.map((n) => n.position.y));

  const clipNodes = wfNodes.map((n) => ({
    relX: n.position.x - originX,
    relY: n.position.y - originY,
    data: cloneNodeData(n.data as WfNodeData),
  }));

  const clipEdges = edges
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e) => ({
      sourceIndex: idToIndex.get(e.source)!,
      targetIndex: idToIndex.get(e.target)!,
      sourceHandle: e.sourceHandle ?? undefined,
    }));

  return { originX, originY, nodes: clipNodes, edges: clipEdges };
}

export function pasteClipboard(
  clipboard: WfNodeClipboard,
  generation: number,
): { nodes: Node<WfNodeData>[]; edges: Edge[] } {
  const base = {
    x: clipboard.originX + PASTE_OFFSET.x * generation,
    y: clipboard.originY + PASTE_OFFSET.y * generation,
  };

  const idMap = new Map<number, string>();
  const newNodes: Node<WfNodeData>[] = clipboard.nodes.map((item, i) => {
    const stepKey = crypto.randomUUID();
    idMap.set(i, stepKey);
    const position = { x: base.x + item.relX, y: base.y + item.relY };
    return {
      id: stepKey,
      type: 'wfNode',
      position,
      selected: true,
      data: {
        ...item.data,
        config: {
          ...item.data.config,
          stepKey,
          ui: position,
        },
      },
    };
  });

  const newEdges: Edge[] = clipboard.edges.map((e) => {
    const source = idMap.get(e.sourceIndex)!;
    const target = idMap.get(e.targetIndex)!;
    const edgeId = `e-${source}-${target}-${e.sourceHandle ?? 'd'}`;
    return buildFlowEdge(edgeId, source, target, e.sourceHandle);
  });

  return { nodes: newNodes, edges: newEdges };
}

export function isWorkflowEditorEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}
