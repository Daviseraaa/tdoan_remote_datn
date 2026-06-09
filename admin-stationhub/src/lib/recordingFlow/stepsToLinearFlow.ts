import type { Edge, Node } from '@xyflow/react';
import { WF_EDGE_TYPE } from '@/src/lib/workflowGraph/types';
import type { RecordingFlowModule, RecordingFlowNodeData } from './types';

export const RECORDING_NODE_X_SPACING = 280;
export const RECORDING_FLOW_NODE_TYPE = 'recordingFlow';

export type RecordingFlowStepInput = {
  id: string;
  action: string;
  actionLabel: string;
  summary: string;
  label: string;
  index: number;
};

export function buildLinearRecordingFlow(
  items: RecordingFlowStepInput[],
  module: RecordingFlowModule,
  options?: { nodeXSpacing?: number },
): { nodes: Node<RecordingFlowNodeData>[]; edges: Edge[] } {
  const spacing = options?.nodeXSpacing ?? RECORDING_NODE_X_SPACING;
  const y = 180;
  const nodes: Node<RecordingFlowNodeData>[] = items.map((item, i) => ({
    id: item.id,
    type: RECORDING_FLOW_NODE_TYPE,
    position: { x: 40 + i * spacing, y },
    data: {
      stepId: item.id,
      action: item.action,
      actionLabel: item.actionLabel,
      summary: item.summary,
      label: item.label,
      index: item.index,
      module,
    },
    draggable: false,
    selectable: true,
  }));

  const edges: Edge[] = items.slice(0, -1).map((item, i) => ({
    id: `e-${item.id}-${items[i + 1].id}`,
    source: item.id,
    target: items[i + 1].id,
    type: WF_EDGE_TYPE,
    animated: false,
    style: { stroke: 'rgba(164, 230, 255, 0.65)', strokeWidth: 2 },
  }));

  return { nodes, edges };
}
