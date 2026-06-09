import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { PanelRightOpen } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import {
  buildLinearRecordingFlow,
  RECORDING_NODE_X_SPACING,
  type RecordingFlowStepInput,
} from '@/src/lib/recordingFlow/stepsToLinearFlow';
import type { RecordingFlowModule, RecordingFlowNodeData } from '@/src/lib/recordingFlow/types';
import { recordingFlowNodeTypes } from './recordingFlowNodeTypes';
import { RecordingFlowHeader } from './RecordingFlowHeader';
import { RecordingFlowInspectorPanel } from './RecordingFlowInspectorPanel';

type Props<T extends { id: string; action: string }> = {
  module: RecordingFlowModule;
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  readOnly?: boolean;
  readOnlyHint?: string;
  steps: T[];
  getStepInput: (step: T, index: number) => Omit<RecordingFlowStepInput, 'id' | 'index'>;
  metaContent?: React.ReactNode;
  renderStepInspector: (step: T | null) => React.ReactNode;
  toolbar?: React.ReactNode;
  message?: string;
};

export function RecordingFlowEditor<T extends { id: string; action: string }>(props: Props<T>) {
  return (
    <ReactFlowProvider>
      <RecordingFlowEditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

function RecordingFlowEditorCanvas<T extends { id: string; action: string }>({
  module,
  title,
  subtitle,
  backLabel,
  onBack,
  readOnly = false,
  readOnlyHint,
  steps,
  getStepInput,
  metaContent,
  renderStepInspector,
  toolbar,
  message,
}: Props<T>) {
  const isCompact = !useMediaQuery('(min-width: 1024px)');
  const nodeXSpacing = isCompact ? 180 : RECORDING_NODE_X_SPACING;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RecordingFlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const rfRef = useRef<{ fitView: (opts?: { padding?: number }) => void } | null>(null);

  const flowInputs = useMemo(
    () =>
      steps.map((step, index) => {
        const labels = getStepInput(step, index);
        return {
          id: step.id,
          index,
          ...labels,
        };
      }),
    [steps, getStepInput],
  );

  const flowSig = useMemo(
    () => flowInputs.map((s) => `${s.id}:${s.actionLabel}:${s.summary}`).join('|'),
    [flowInputs],
  );

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = buildLinearRecordingFlow(
      flowInputs,
      module,
      { nodeXSpacing },
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: isCompact ? 0.4 : 0.2 });
    });
  }, [flowSig, module, nodeXSpacing, isCompact, setNodes, setEdges]);

  useEffect(() => {
    if (selectedStepId && !steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(null);
    }
  }, [steps, selectedStepId]);

  useEffect(() => {
    if (!isCompact || !propertiesOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isCompact, propertiesOpen]);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const inspectorTitle = selectedStep
    ? t('chromeScripts.inspector')
    : t('chromeScripts.flow');

  const onSelectionChange = useCallback(({ nodes: selNodes }: OnSelectionChangeParams) => {
    const one = selNodes.length === 1 ? selNodes[0] : null;
    if (one) {
      setSelectedStepId(one.id);
      setPropertiesOpen(true);
    } else if (selNodes.length === 0) {
      setSelectedStepId(null);
      setPropertiesOpen(false);
    }
  }, []);

  return (
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden bg-surface-container-lowest">
      <RecordingFlowHeader
        compact={isCompact}
        title={title}
        subtitle={subtitle}
        backLabel={backLabel}
        onBack={onBack}
        readOnly={readOnly}
        readOnlyHint={readOnlyHint}
        stepCount={steps.length}
        message={message}
        toolbar={toolbar}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <div className="flex-1 min-w-0 min-h-0 relative w-full h-full">
          {steps.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-on-surface-variant px-6 text-center z-[1]">
              {t('chromeScripts.stepEmpty')}
            </div>
          ) : null}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            nodeTypes={recordingFlowNodeTypes}
            nodesDraggable={!readOnly}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            panOnScroll={isCompact}
            zoomOnPinch
            zoomOnScroll={!isCompact}
            onInit={(inst) => {
              rfRef.current = inst;
              inst.fitView({ padding: isCompact ? 0.4 : 0.2 });
            }}
            onPaneClick={() => {
              setSelectedStepId(null);
              setPropertiesOpen(false);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            minZoom={0.12}
            maxZoom={1.5}
            style={{ width: '100%', height: '100%' }}
            className="bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-[length:20px_20px]"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="rgba(255,255,255,0.06)" />
            <Controls
              showInteractive={false}
              className={cn(
                '!bg-surface-container-high !border-white/10',
                isCompact && '!left-3 !bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
              )}
            />
            {!isCompact ? (
              <MiniMap
                className="!bg-surface-container-high/90 !border-white/10 !rounded-xl"
                nodeColor={() => '#64748b'}
                maskColor="rgba(0,0,0,0.6)"
              />
            ) : null}
          </ReactFlow>

          {!propertiesOpen && isCompact ? (
            <button
              type="button"
              onClick={() => setPropertiesOpen(true)}
              className={cn(
                'absolute z-10 flex items-center gap-2 px-4 py-2.5 rounded-full',
                'bg-primary text-on-primary text-xs font-bold shadow-lg shadow-primary/25',
                'right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]',
              )}
              aria-label={t('chromeScripts.inspector')}
            >
              <PanelRightOpen size={16} />
              {t('chromeScripts.inspector')}
            </button>
          ) : null}

          {!propertiesOpen && !isCompact ? (
            <button
              type="button"
              onClick={() => setPropertiesOpen(true)}
              className="absolute right-3 top-3 z-10 px-3 py-2 rounded-xl bg-surface-container-high/90 border border-white/10 text-[10px] font-bold"
            >
              {t('chromeScripts.inspector')}
            </button>
          ) : null}

          <RecordingFlowInspectorPanel
            open={propertiesOpen}
            compact={isCompact}
            title={inspectorTitle}
            onClose={() => setPropertiesOpen(false)}
            readOnlyHint={readOnly ? readOnlyHint : undefined}
            metaContent={
              metaContent ? (
                <div className={cn(selectedStep && 'pb-4 border-b border-white/5')}>{metaContent}</div>
              ) : undefined
            }
          >
            {renderStepInspector(selectedStep)}
          </RecordingFlowInspectorPanel>
        </div>
      </div>
    </div>
  );
}
