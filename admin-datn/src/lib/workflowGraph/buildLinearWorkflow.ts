import type { Edge, Node } from '@xyflow/react';
import { t } from '@/src/i18n/t';
import type { CreateWorkflowDto } from '@/src/types/api';
import { buildFlowEdge } from './layout';
import { flowToWorkflowPayload } from './serialize';
import { WF_TRIGGER_ID, type WfNodeData } from './types';
import type { BuiltWorkflowNode } from './chromeScriptImport';
import { NODE_X_SPACING } from './chromeScriptImport';

const TRIGGER_X = 48;
const BASE_Y = 240;

export function buildLinearWorkflowDto(
  name: string,
  description: string,
  built: BuiltWorkflowNode[],
): CreateWorkflowDto | null {
  if (built.length === 0) return null;

  const triggerNode: Node<WfNodeData> = {
    id: WF_TRIGGER_ID,
    type: 'wfNode',
    deletable: false,
    selectable: true,
    draggable: false,
    position: { x: TRIGGER_X, y: BASE_Y },
    data: {
      kind: 'trigger',
      label: t('workflows.manualTrigger'),
      stepType: 'COMMAND',
      config: {},
      onFailure: 'STOP',
      runStatus: 'idle',
    },
  };

  const stepNodes: Node<WfNodeData>[] = built.map((item, i) => {
    const x = TRIGGER_X + (i + 1) * NODE_X_SPACING;
    const y = BASE_Y;
    return {
      id: item.stepKey,
      type: 'wfNode',
      position: { x, y },
      data: {
        ...item.data,
        config: {
          ...item.data.config,
          stepKey: item.stepKey,
          ui: { x, y },
        },
      },
    };
  });

  const edges: Edge[] = [
    buildFlowEdge('e-trigger-first', WF_TRIGGER_ID, built[0]!.stepKey),
    ...built.slice(0, -1).map((item, i) =>
      buildFlowEdge(`e-chain-${i}`, item.stepKey, built[i + 1]!.stepKey),
    ),
  ];

  const { steps, graph } = flowToWorkflowPayload([triggerNode, ...stepNodes], edges);

  return {
    name: name.trim() || t('workflows.untitled'),
    description,
    isActive: false,
    steps,
    graph,
  };
}
