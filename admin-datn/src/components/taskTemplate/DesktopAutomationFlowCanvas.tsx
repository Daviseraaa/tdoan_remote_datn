import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Clock,
  Command,
  Keyboard,
  Layers,
  MousePointer2,
  Move,
  PanelRightOpen,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { RecordingFlowInspectorPanel } from '@/src/components/recordingFlow/RecordingFlowInspectorPanel';
import { DesktopStepInspector } from '@/src/components/desktopRecording/DesktopStepInspector';
import { TemplateFlowPaletteDrawer } from './TemplateFlowPaletteDrawer';
import { WfImportMenu } from '@/src/components/workflow/WfImportMenu';
import { desktopStepsFromTaskTemplate } from '@/src/lib/taskTemplatePayload';
import { desktopStepsFromWorkflow } from '@/src/lib/workflowGraph';
import {
  actionLabel,
  DESKTOP_STEP_PALETTE,
  parseStepsFromJson,
  type DesktopAction,
} from '@/src/lib/desktopRecordingSteps';
import {
  DESKTOP_STEPS_MAX,
  newDesktopStep,
  summarizeDesktopStep,
  type DesktopStep,
} from '@/src/lib/taskTemplatePayload';
import {
  buildLinearRecordingFlow,
  RECORDING_NODE_X_SPACING,
  type RecordingFlowStepInput,
} from '@/src/lib/recordingFlow/stepsToLinearFlow';
import type { RecordingFlowNodeData } from '@/src/lib/recordingFlow/types';
import { recordingFlowNodeTypes } from '@/src/components/recordingFlow/recordingFlowNodeTypes';
import type { DesktopRecording, TaskTemplate, Workflow } from '@/src/types/api';

const PALETTE_ICONS: Record<
  DesktopAction,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  delay: Clock,
  openApp: AppWindow,
  move: Move,
  click: MousePointer2,
  typeText: Keyboard,
  keyCombo: Command,
  scroll: ScrollText,
};

type Props = {
  compact?: boolean;
  steps: DesktopStep[];
  onStepsChange: (steps: DesktopStep[]) => void;
  inspectorFooter?: React.ReactNode;
};

export function DesktopAutomationFlowCanvas({
  compact,
  steps,
  onStepsChange,
  inspectorFooter,
}: Props) {
  const isCompact = Boolean(compact);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<RecordingFlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rfRef = useRef<{ fitView: (opts?: { padding?: number }) => void } | null>(null);

  const getStepInput = useCallback((step: DesktopStep, index: number) => {
    const label = actionLabel(step.action);
    return {
      action: step.action,
      actionLabel: label,
      summary: summarizeDesktopStep(step),
      label: `${index + 1}. ${label}`,
    } satisfies Omit<RecordingFlowStepInput, 'id' | 'index'>;
  }, []);

  const flowInputs = useMemo(
    () =>
      steps.map((step, index) => ({
        id: step.id,
        index,
        ...getStepInput(step, index),
      })),
    [steps, getStepInput],
  );

  const flowSig = useMemo(
    () => flowInputs.map((s) => `${s.id}:${s.actionLabel}:${s.summary}`).join('|'),
    [flowInputs],
  );

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = buildLinearRecordingFlow(flowInputs, 'desktop', {
      nodeXSpacing: isCompact ? 180 : RECORDING_NODE_X_SPACING,
    });
    setNodes(nextNodes);
    setEdges(nextEdges);
    requestAnimationFrame(() => {
      rfRef.current?.fitView({ padding: isCompact ? 0.4 : 0.2 });
    });
  }, [flowSig, isCompact, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === selectedStepId })));
  }, [selectedStepId, setNodes]);

  useEffect(() => {
    if (selectedStepId && !steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(null);
    }
  }, [steps, selectedStepId]);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  const selectedIndex = selectedStep ? steps.findIndex((s) => s.id === selectedStep.id) : -1;

  const updateSteps = useCallback(
    (next: DesktopStep[]) => {
      onStepsChange(next);
      if (selectedStepId && !next.some((s) => s.id === selectedStepId)) {
        setSelectedStepId(null);
      }
    },
    [onStepsChange, selectedStepId],
  );

  const addStep = (action: DesktopAction) => {
    if (steps.length >= DESKTOP_STEPS_MAX) return;
    const step = newDesktopStep(action);
    updateSteps([...steps, step]);
    setSelectedStepId(step.id);
    setPropertiesOpen(true);
  };

  const updateStep = (id: string, patch: Partial<DesktopStep>) => {
    updateSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    updateSteps(steps.filter((s) => s.id !== id));
  };

  const moveStep = (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateSteps(next);
  };

  const applyDesktopSteps = (imported: DesktopStep[]) => {
    if (imported.length === 0) return;
    updateSteps(imported.slice(0, DESKTOP_STEPS_MAX));
    setSelectedStepId(imported[0]?.id ?? null);
    setPropertiesOpen(true);
  };

  const importRecording = (recording: DesktopRecording) => {
    applyDesktopSteps(parseStepsFromJson(recording.steps));
  };

  const importFromTaskTemplate = (template: TaskTemplate) => {
    applyDesktopSteps(desktopStepsFromTaskTemplate(template));
  };

  const importFromWorkflow = (workflow: Workflow) => {
    applyDesktopSteps(desktopStepsFromWorkflow(workflow));
  };

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

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, dragged: Node<RecordingFlowNodeData>) => {
      setNodes((currentNodes) => {
        const sorted = [...currentNodes].sort((a, b) => a.position.x - b.position.x);
        const orderIds = sorted.map((n) => n.id);
        const reordered = orderIds
          .map((id) => steps.find((s) => s.id === id))
          .filter((s): s is DesktopStep => Boolean(s));
        if (reordered.length === steps.length) {
          onStepsChange(reordered);
        }
        return currentNodes.map((n) =>
          n.id === dragged.id ? { ...n, position: dragged.position } : n,
        );
      });
    },
    [steps, onStepsChange, setNodes],
  );

  const paletteBody = (
    <>
      <WfImportMenu
        compact
        onImportChromeScript={() => {}}
        onImportDesktopRecording={importRecording}
        onImportTaskTemplate={importFromTaskTemplate}
        onImportWorkflow={importFromWorkflow}
      />
      <div className="space-y-2">
        {DESKTOP_STEP_PALETTE.map((action) => {
          const Icon = PALETTE_ICONS[action];
          const atMax = steps.length >= DESKTOP_STEPS_MAX;
          return (
            <button
              key={action}
              type="button"
              disabled={atMax}
              onClick={() => {
                addStep(action);
                if (isCompact) setPaletteOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 hover:border-primary/30 text-left text-xs font-bold transition-all disabled:opacity-40"
            >
              <Icon size={15} className="text-primary shrink-0" />
              <span className="truncate">{actionLabel(action)}</span>
              <Plus size={13} className="ml-auto opacity-50" />
            </button>
          );
        })}
      </div>
    </>
  );

  const inspectorTitle = selectedStep
    ? t('templateWizard.desktopProps')
    : t('templateWizard.desktopConfigMeta');

  const inspectorContent = (
    <>
      <div className={cn(selectedStep && 'pb-4 border-b border-white/5')}>
        <p className="text-[10px] text-on-surface-variant">
          {t('templateWizard.desktopStepCountMax', {
            count: String(steps.length),
            max: String(DESKTOP_STEPS_MAX),
          })}
        </p>
      </div>
      {selectedStep ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={selectedIndex <= 0}
              onClick={() => moveStep(selectedStep.id, -1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold disabled:opacity-40"
            >
              <ChevronLeft size={14} />
              {t('templateWizard.moveStepBack')}
            </button>
            <button
              type="button"
              disabled={selectedIndex < 0 || selectedIndex >= steps.length - 1}
              onClick={() => moveStep(selectedStep.id, 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-[10px] font-bold disabled:opacity-40"
            >
              {t('templateWizard.moveStepForward')}
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => removeStep(selectedStep.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-error/30 text-error text-[10px] font-bold hover:bg-error/10 ml-auto"
            >
              <Trash2 size={13} />
              {t('templateWizard.desktopDeleteStep')}
            </button>
          </div>
          <DesktopStepInspector
            step={selectedStep}
            onChange={(patch) => updateStep(selectedStep.id, patch)}
          />
        </>
      ) : (
        <p className="text-xs text-on-surface-variant">{t('desktopRecordings.selectStep')}</p>
      )}
      {inspectorFooter}
    </>
  );

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden rounded-xl border border-white/5 bg-surface-container-lowest">
      {!isCompact && !paletteCollapsed ? (
        <aside className="w-[min(220px,28vw)] shrink-0 border-r border-white/5 bg-surface-container-low/50 flex flex-col overflow-hidden">
          <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between">
            <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('templateWizard.desktopPalette')}
            </p>
            <button
              type="button"
              onClick={() => setPaletteCollapsed(true)}
              className="text-[10px] text-on-surface-variant hover:text-on-surface"
            >
              ◀
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 min-h-0">{paletteBody}</div>
        </aside>
      ) : null}

      <TemplateFlowPaletteDrawer
        title={t('templateWizard.desktopPalette')}
        open={isCompact && paletteOpen}
        onClose={() => setPaletteOpen(false)}
      >
        {paletteBody}
      </TemplateFlowPaletteDrawer>

      <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
        {!isCompact && paletteCollapsed ? (
          <button
            type="button"
            onClick={() => setPaletteCollapsed(false)}
            className="absolute left-3 top-3 z-10 px-2 py-1 rounded-lg bg-surface-container-high/90 border border-white/10 text-[10px] font-bold"
          >
            ▶ {t('templateWizard.desktopPalette')}
          </button>
        ) : null}

        {steps.length === 0 ? (
          <div className="absolute inset-0 z-[1] flex items-center justify-center text-sm text-on-surface-variant px-6 text-center pointer-events-none">
            {t('templateWizard.desktopEmpty')}
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onSelectionChange={onSelectionChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={recordingFlowNodeTypes}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
            panOnScroll={isCompact}
            zoomOnPinch
            zoomOnScroll={!isCompact}
            onInit={(inst) => {
              rfRef.current = inst;
              inst.fitView({ padding: isCompact ? 0.4 : 0.2 });
            }}
            style={{ width: '100%', height: '100%' }}
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
            className="bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-[length:20px_20px]"
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="rgba(255,255,255,0.06)" />
            <Controls
              showInteractive={false}
              className={cn(
                '!bg-surface-container-high !border-white/10',
                isCompact && '!left-3 !bottom-24',
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

        {isCompact ? (
          <div className="absolute left-3 bottom-3 z-10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-high/95 border border-white/10 text-[10px] font-bold shadow-lg"
            >
              <Layers size={14} />
              {t('templateWizard.desktopPalette')}
            </button>
          </div>
        ) : null}

        {!propertiesOpen && isCompact ? (
          <button
            type="button"
            onClick={() => setPropertiesOpen(true)}
            className={cn(
              'absolute z-10 flex items-center gap-2 px-4 py-2.5 rounded-full',
              'bg-primary text-on-primary text-xs font-bold shadow-lg shadow-primary/25',
              'right-3 bottom-3',
            )}
          >
            <PanelRightOpen size={16} />
            {t('templateWizard.desktopProps')}
          </button>
        ) : null}

        {!propertiesOpen && !isCompact ? (
          <button
            type="button"
            onClick={() => setPropertiesOpen(true)}
            className="absolute right-3 top-3 z-10 px-3 py-2 rounded-xl bg-surface-container-high/90 border border-white/10 text-[10px] font-bold"
          >
            {t('templateWizard.desktopProps')}
          </button>
        ) : null}

        <RecordingFlowInspectorPanel
          open={propertiesOpen}
          compact={isCompact}
          title={inspectorTitle}
          onClose={() => setPropertiesOpen(false)}
        >
          {inspectorContent}
        </RecordingFlowInspectorPanel>
      </div>
    </div>
  );
}
