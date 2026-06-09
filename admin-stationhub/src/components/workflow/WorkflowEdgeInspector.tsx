import { Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  type WfNodeData,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import type { Edge, Node } from '@xyflow/react';

type Props = {
  edge: Edge | null;
  nodes: Node<WfNodeData>[];
  onUpdateBranch: (handle: typeof WF_HANDLE_TRUE | typeof WF_HANDLE_FALSE) => void;
  onDelete: () => void;
};

function nodeLabel(nodes: Node<WfNodeData>[], id: string): string {
  const n = nodes.find((x) => x.id === id);
  if (!n) return id;
  const d = n.data as WfNodeData;
  return d.label || id;
}

export function WorkflowEdgeInspector({ edge, nodes, onUpdateBranch, onDelete }: Props) {
  if (!edge) return null;

  const sourceNode = nodes.find((n) => n.id === edge.source);
  const sourceKind = (sourceNode?.data as WfNodeData | undefined)?.kind;
  const isCondition = sourceKind === 'condition';
  const branch =
    edge.sourceHandle === WF_HANDLE_FALSE
      ? WF_HANDLE_FALSE
      : edge.sourceHandle === WF_HANDLE_TRUE
        ? WF_HANDLE_TRUE
        : WF_HANDLE_TRUE;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
      <h3 className="text-sm font-bold">{t('workflows.edgeInspectorTitle')}</h3>

      <div className="space-y-2 text-sm">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('workflows.edgeFrom')}
          </span>
          <p className="mt-0.5 font-bold text-on-surface">{nodeLabel(nodes, edge.source)}</p>
        </div>
        <div>
          <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('workflows.edgeTo')}
          </span>
          <p className="mt-0.5 font-bold text-on-surface">{nodeLabel(nodes, edge.target)}</p>
        </div>
      </div>

      {isCondition ? (
        <div>
          <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
            {t('workflows.edgeBranch')}
          </label>
          <select
            value={branch}
            onChange={(e) =>
              onUpdateBranch(
                e.target.value === WF_HANDLE_FALSE ? WF_HANDLE_FALSE : WF_HANDLE_TRUE,
              )
            }
            className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
          >
            <option value={WF_HANDLE_TRUE}>{t('workflows.branchTrue')}</option>
            <option value={WF_HANDLE_FALSE}>{t('workflows.branchFalse')}</option>
          </select>
          <p className="text-[10px] text-on-surface-variant mt-2">{t('workflows.conditionHint')}</p>
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant">{t('workflows.edgeDefaultHint')}</p>
      )}

      <button
        type="button"
        onClick={onDelete}
        className={cn(
          'w-full py-3 rounded-xl border border-error/30 text-error font-bold text-sm',
          'flex items-center justify-center gap-2 hover:bg-error/10',
        )}
      >
        <Trash2 size={16} />
        {t('workflows.deleteEdge')}
      </button>
    </div>
  );
}
