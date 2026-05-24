import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
} from '@xyflow/react';
import {
  PlayCircle,
  Save,
  Loader2,
  Maximize2,
  AlertTriangle,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { workflowNodeTypes } from './workflowNodeTypes';
import { WorkflowNodePalette } from './WorkflowNodePalette';
import { WorkflowStepInspector } from './WorkflowStepInspector';
import { WorkflowTriggerInspector } from './WorkflowTriggerInspector';
import * as triggersApi from '@/src/api/triggers';
import {
  defaultEntryTriggerDraft,
  draftFromWorkflowTrigger,
  entryTriggerNodeLabel,
  entryTriggerTypeSubtitle,
  pickEntryTrigger,
  type EntryTriggerDraft,
} from '@/src/lib/workflowEntryTrigger';
import { WorkflowEdgeInspector } from './WorkflowEdgeInspector';
import { WorkflowExecutionPanel } from './WorkflowExecutionPanel';
import { WfAgentSelect } from './WfAgentSelect';
import {
  WF_TRIGGER_ID,
  flowToWorkflowPayload,
  newConditionNodeData,
  newDelayNodeData,
  newTelegramNodeData,
  newTaskNodeData,
  workflowGraphFingerprint,
  workflowToFlow,
  WF_EDGE_TYPE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  getUpstreamStepKeys,
  type UpstreamOutputKey,
  type WfNodeData,
  type WfRunStatus,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import type {
  Agent,
  ExecuteWorkflowResult,
  TaskType,
  Workflow,
} from '@/src/types/api';
import type { WorkflowSavePayload } from '@/src/hooks/useWorkflowPage';

type Props = {
  workflow: Workflow;
  agents: Agent[];
  defaultAgentId: string;
  onDefaultAgentIdChange: (id: string) => void;
  onMetaChange: (
    patch: Partial<
      Pick<Workflow, 'name' | 'description' | 'cronExpression' | 'isActive' | 'variables'>
    >,
  ) => void;
  onDirty: () => void;
  isDirty: boolean;
  onSave: (payload: WorkflowSavePayload) => Promise<void>;
  onRun: (payload: WorkflowSavePayload) => Promise<void>;
  saving: boolean;
  running: boolean;
  saveOk: boolean;
  error?: string;
  detailLoading?: boolean;
  executionResult: ExecuteWorkflowResult | null;
  runStatusByStepId: Record<string, WfRunStatus>;
  graphReloadToken: number;
  onOpenWorkflowList?: () => void;
  onEditorPaneClick?: () => void;
  onDeleteWorkflow?: () => void;
};

const EDGE_STYLE = { stroke: 'rgba(164, 230, 255, 0.65)', strokeWidth: 2 };
const EDGE_STYLE_SELECTED = { stroke: 'rgba(164, 230, 255, 1)', strokeWidth: 3 };

function withEdgeSelection(eds: Edge[], selectedId: string | null): Edge[] {
  return eds.map((e) => ({
    ...e,
    selected: selectedId === e.id,
    style: selectedId === e.id ? EDGE_STYLE_SELECTED : EDGE_STYLE,
  }));
}

export function WorkflowEditor({
  workflow,
  agents,
  defaultAgentId,
  onDefaultAgentIdChange,
  onMetaChange,
  onDirty,
  isDirty,
  onSave,
  onRun,
  saving,
  running,
  saveOk,
  error,
  detailLoading,
  executionResult,
  runStatusByStepId,
  graphReloadToken,
  onOpenWorkflowList,
  onEditorPaneClick,
  onDeleteWorkflow,
}: Props) {
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<{ fitView: (o?: { padding?: number }) => void } | null>(
    null,
  );
  const [entryTrigger, setEntryTrigger] = useState<EntryTriggerDraft>(defaultEntryTriggerDraft);
  const [newTelegramBot, setNewTelegramBot] = useState<{ name: string; botToken: string } | null>(
    null,
  );
  const entryTriggerSyncSig = useRef('');

  const { data: workflowTriggers } = useQuery({
    queryKey: ['workflow-triggers', workflow.id],
    queryFn: () => triggersApi.listTriggers(workflow.id),
    enabled: Boolean(workflow.id),
  });

  const graphFp = useMemo(() => workflowGraphFingerprint(workflow), [workflow]);

  const initial = useMemo(
    () => workflowToFlow(workflow, runStatusByStepId),
    [workflow.id, graphReloadToken, graphFp],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  useEffect(() => {
    const g = workflowToFlow(workflow, runStatusByStepId);
    setNodes(g.nodes);
    setEdges(g.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPropertiesOpen(false);
    requestAnimationFrame(() => {
      rfInstance?.fitView({ padding: 0.15, duration: 200 });
    });
  }, [workflow.id, graphReloadToken, graphFp, setNodes, setEdges, rfInstance]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...(n.data as WfNodeData),
          runStatus: runStatusByStepId[n.id] ?? (n.data as WfNodeData).runStatus ?? 'idle',
        },
      })),
    );
  }, [runStatusByStepId, setNodes]);

  useEffect(() => {
    if (executionResult || running) setExecutionOpen(true);
  }, [executionResult, running]);

  const applyEntryTriggerToCanvas = useCallback(
    (draft: EntryTriggerDraft) => {
      const label = entryTriggerNodeLabel(draft);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === WF_TRIGGER_ID
            ? {
                ...n,
                data: {
                  ...(n.data as WfNodeData),
                  label,
                  config: {
                    ...(n.data as WfNodeData).config,
                    triggerType: draft.type,
                  },
                },
              }
            : n,
        ),
      );
    },
    [setNodes],
  );

  useEffect(() => {
    if (!workflow.id) return;
    const sig = `${workflow.id}|${graphReloadToken}|${(workflowTriggers ?? []).map((tr) => tr.id).join(',')}`;
    if (entryTriggerSyncSig.current === sig) return;
    entryTriggerSyncSig.current = sig;
    const draft = draftFromWorkflowTrigger(pickEntryTrigger(workflowTriggers ?? []));
    setEntryTrigger(draft);
    setNewTelegramBot(null);
    applyEntryTriggerToCanvas(draft);
  }, [workflow.id, graphReloadToken, workflowTriggers, applyEntryTriggerToCanvas]);

  const patchEntryTrigger = useCallback(
    (patch: Partial<EntryTriggerDraft>) => {
      setEntryTrigger((prev) => {
        const next = { ...prev, ...patch };
        applyEntryTriggerToCanvas(next);
        return next;
      });
      onDirty();
    },
    [applyEntryTriggerToCanvas, onDirty],
  );

  const currentPayload = useCallback(
    () => ({
      ...flowToWorkflowPayload(nodes as Node<WfNodeData>[], edges),
      entryTrigger,
      newTelegramBot: newTelegramBot ?? undefined,
    }),
    [nodes, edges, entryTrigger, newTelegramBot],
  );

  const isTriggerSelected = selectedNodeId === WF_TRIGGER_ID;

  const onConnect = useCallback(
    (conn: Connection) => {
      const srcNode = nodes.find((n) => n.id === conn.source);
      const kind = (srcNode?.data as WfNodeData | undefined)?.kind;
      const handle = conn.sourceHandle ?? undefined;
      if (kind === 'condition' && handle !== WF_HANDLE_TRUE && handle !== WF_HANDLE_FALSE) {
        return;
      }
      const label =
        handle === WF_HANDLE_TRUE
          ? t('workflows.branchTrue')
          : handle === WF_HANDLE_FALSE
            ? t('workflows.branchFalse')
            : undefined;
      const dup = edges.some(
        (e) =>
          e.source === conn.source &&
          e.target === conn.target &&
          (e.sourceHandle ?? '') === (conn.sourceHandle ?? ''),
      );
      if (dup) return;

      setEdges((eds) =>
        addEdge(
          {
            ...conn,
            type: WF_EDGE_TYPE,
            animated: false,
            style: { stroke: 'rgba(164, 230, 255, 0.55)', strokeWidth: 2 },
            label,
            labelStyle: label ? { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 } : undefined,
          },
          eds,
        ),
      );
      onDirty();
    },
    [setEdges, onDirty, nodes, edges],
  );

  const onNodeDragStop: NodeDragHandler = useCallback(
    (_, node) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== node.id) return n;
          const d = n.data as WfNodeData;
          return {
            ...n,
            position: node.position,
            data: {
              ...d,
              config: { ...d.config, ui: { x: node.position.x, y: node.position.y } },
            },
          };
        }),
      );
      onDirty();
    },
    [setNodes, onDirty],
  );

  const maxX = useMemo(() => {
    const xs = nodes.map((n) => n.position.x);
    return xs.length ? Math.max(...xs) : 48;
  }, [nodes]);

  const appendNode = useCallback(
    (data: WfNodeData) => {
      const chainFromSelected =
        propertiesOpen &&
        selectedNodeId &&
        selectedNodeId !== WF_TRIGGER_ID &&
        !selectedEdgeId;

      const stepKey = crypto.randomUUID();
      const id = stepKey;
      const stepCount = nodes.filter((n) => n.id !== WF_TRIGGER_ID).length;
      let position = { x: maxX + 300, y: 220 + (stepCount % 4) * 48 };

      if (chainFromSelected) {
        const src = nodes.find((n) => n.id === selectedNodeId);
        if (src) {
          position = { x: src.position.x + 300, y: src.position.y };
        }
      }

      const newNode: Node<WfNodeData> = {
        id,
        type: 'wfNode',
        position,
        data: {
          ...data,
          config: { ...data.config, ui: position, stepKey },
        },
      };

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        { ...newNode, selected: true },
      ]);

      if (chainFromSelected && selectedNodeId) {
        const srcNode = nodes.find((n) => n.id === selectedNodeId);
        const kind = (srcNode?.data as WfNodeData | undefined)?.kind;
        const handle = kind === 'condition' ? WF_HANDLE_TRUE : undefined;
        const edgeId = `e-${selectedNodeId}-${id}-${handle ?? 'd'}`;
        setEdges((eds) =>
          withEdgeSelection(
            [
              ...eds,
              {
                id: edgeId,
                source: selectedNodeId,
                target: id,
                sourceHandle: handle,
                type: WF_EDGE_TYPE,
                animated: false,
                style: EDGE_STYLE,
                label:
                  handle === WF_HANDLE_TRUE
                    ? t('workflows.branchTrue')
                    : handle === WF_HANDLE_FALSE
                      ? t('workflows.branchFalse')
                      : undefined,
                labelStyle: handle
                  ? { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 }
                  : undefined,
              },
            ],
            null,
          ),
        );
        setSelectedEdgeId(null);
        setSelectedNodeId(id);
        setPropertiesOpen(true);
      } else {
        setSelectedEdgeId(null);
        setSelectedNodeId(id);
        setPropertiesOpen(false);
      }
      onDirty();
    },
    [nodes, maxX, propertiesOpen, selectedNodeId, selectedEdgeId, setNodes, setEdges, onDirty],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedData = selectedNode?.data as WfNodeData | undefined;

  const graphEdgesForUpstream = useMemo(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
      })),
    [edges],
  );

  const upstreamOutputKeys: UpstreamOutputKey[] = useMemo(() => {
    if (!selectedNodeId) return [];
    return getUpstreamStepKeys(
      selectedNodeId,
      graphEdgesForUpstream,
      nodes.map((n) => ({ id: n.id, data: n.data as WfNodeData })),
    );
  }, [selectedNodeId, graphEdgesForUpstream, nodes]);

  const workflowVarKeys = useMemo(
    () => Object.keys(workflow.variables ?? {}),
    [workflow.variables],
  );

  const variablesJson = useMemo(
    () => JSON.stringify(workflow.variables ?? {}, null, 2),
    [workflow.variables],
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId],
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<WfNodeData> & { config?: WfNodeData['config'] }) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const prev = n.data as WfNodeData;
          return {
            ...n,
            data: {
              ...prev,
              ...patch,
              config: patch.config ? { ...prev.config, ...patch.config } : prev.config,
            },
          };
        }),
      );
      onDirty();
    },
    [selectedNodeId, setNodes, onDirty],
  );

  const canDeleteNode =
    Boolean(selectedNodeId) && selectedNodeId !== WF_TRIGGER_ID;
  const canDeleteEdge = Boolean(selectedEdgeId);
  const canDeleteSelection = canDeleteNode || canDeleteEdge;

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId || selectedNodeId === WF_TRIGGER_ID) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      withEdgeSelection(
        eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
        null,
      ),
    );
    setSelectedNodeId(null);
    setPropertiesOpen(false);
    onDirty();
  }, [selectedNodeId, setNodes, setEdges, onDirty]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((eds) => withEdgeSelection(eds.filter((e) => e.id !== selectedEdgeId), null));
    setSelectedEdgeId(null);
    setPropertiesOpen(false);
    onDirty();
  }, [selectedEdgeId, setEdges, onDirty]);

  const deleteSelection = useCallback(() => {
    if (selectedEdgeId) deleteSelectedEdge();
    else deleteSelectedNode();
  }, [selectedEdgeId, deleteSelectedEdge, deleteSelectedNode]);

  const updateSelectedEdgeBranch = useCallback(
    (handle: typeof WF_HANDLE_TRUE | typeof WF_HANDLE_FALSE) => {
      if (!selectedEdgeId) return;
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return;
      const nextId = `e-${edge.source}-${edge.target}-${handle}`;
      setEdges((eds) =>
        withEdgeSelection(
          eds.map((e) => {
            if (e.id !== selectedEdgeId) return e;
            return {
              ...e,
              id: nextId,
              sourceHandle: handle,
              label:
                handle === WF_HANDLE_TRUE
                  ? t('workflows.branchTrue')
                  : t('workflows.branchFalse'),
              labelStyle: { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 },
            };
          }),
          nextId,
        ),
      );
      setSelectedEdgeId(nextId);
      onDirty();
    },
    [selectedEdgeId, edges, setEdges, onDirty],
  );

  const handleSave = () => void onSave(currentPayload());
  const handleRun = () => void onRun(currentPayload());

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-surface-container-lowest">
      <header className="shrink-0 border-b border-white/5 bg-surface-container-low/30">
        <div className="px-3 py-2 flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[220px]">
            <input
              value={workflow.name}
              onChange={(e) => onMetaChange({ name: e.target.value })}
              className="w-full text-base font-bold bg-transparent focus:outline-none placeholder:text-on-surface-variant/40"
              placeholder={t('workflows.untitled')}
            />
            <input
              value={workflow.description ?? ''}
              onChange={(e) => onMetaChange({ description: e.target.value })}
              className="w-full text-xs text-on-surface-variant mt-0.5 bg-transparent focus:outline-none"
              placeholder={t('workflows.descriptionPlaceholder')}
            />
          </div>

          {isDirty ? (
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400/90 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20">
              <AlertTriangle size={12} />
              {t('workflows.unsavedChanges')}
            </span>
          ) : null}

          {detailLoading ? (
            <span className="text-[10px] font-mono text-primary flex items-center gap-1">
              <Loader2 size={12} className="animate-spin" />
              {t('workflows.loadingDetail')}
            </span>
          ) : null}

          {error ? (
            <span className="text-[10px] text-error max-w-[200px] truncate" title={error}>
              {error}
            </span>
          ) : null}
        </div>

        <div className="px-3 pb-2 flex flex-wrap items-center gap-2">
          {onOpenWorkflowList ? (
            <button
              type="button"
              onClick={onOpenWorkflowList}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5"
              title={t('workflows.showWorkflowList')}
            >
              <PanelLeftOpen size={14} />
              {t('workflows.title')}
            </button>
          ) : null}
          <WfAgentSelect
            value={defaultAgentId}
            onChange={onDefaultAgentIdChange}
            agents={agents}
            className="w-[min(200px,28vw)]"
            title={t('workflows.defaultAgent')}
            placeholder={t('workflows.selectDefaultAgent')}
          />

          <input
            value={workflow.cronExpression ?? ''}
            onChange={(e) => onMetaChange({ cronExpression: e.target.value })}
            placeholder={t('workflows.cronPlaceholder')}
            className="text-xs px-3 py-2 rounded-xl bg-black/20 border border-white/10 w-32 font-mono"
            title={t('workflows.cronExpression')}
          />

          <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={workflow.isActive}
              onChange={(e) => onMetaChange({ isActive: e.target.checked })}
              className="rounded"
            />
            {t('workflows.isActive')}
          </label>

          <div className="flex-1" />

          {canDeleteSelection ? (
            <button
              type="button"
              onClick={deleteSelection}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-error/30 text-error hover:bg-error/10"
              title={`${selectedEdgeId ? t('workflows.deleteEdge') : t('workflows.deleteNode')} (${t('workflows.deleteNodeShortcut')})`}
            >
              <Trash2 size={14} />
              {selectedEdgeId ? t('workflows.deleteEdge') : t('workflows.deleteNode')}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => rfInstance?.fitView({ padding: 0.2 })}
            className="p-2 rounded-xl border border-white/10 hover:bg-white/5"
            title={t('workflows.fitView')}
          >
            <Maximize2 size={16} />
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary border border-primary/30 disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saveOk ? t('common.saved') : t('workflows.saveWorkflow')}
          </button>

          <button
            type="button"
            disabled={running || saving}
            onClick={() => void handleRun()}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold',
              running
                ? 'bg-error/15 text-error border border-error/30'
                : 'bg-primary text-on-primary shadow-lg shadow-primary/20',
              'disabled:opacity-40',
            )}
          >
            {running ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PlayCircle size={14} />
            )}
            {running ? t('workflows.executionRunning') : t('workflows.runWorkflow')}
          </button>

          {onDeleteWorkflow ? (
            <button
              type="button"
              onClick={onDeleteWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border border-error/30 text-error hover:bg-error/10"
              title={t('workflows.deleteWorkflow')}
            >
              <Trash2 size={14} />
              {t('workflows.deleteWorkflow')}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <WorkflowNodePalette
          collapsed={paletteCollapsed}
          chainNextStep={
            propertiesOpen &&
            Boolean(selectedNodeId) &&
            selectedNodeId !== WF_TRIGGER_ID &&
            !selectedEdgeId
          }
          onAddDelay={() => {
            const k = crypto.randomUUID();
            appendNode(newDelayNodeData({ x: 0, y: 0 }, k));
          }}
          onAddCondition={() => {
            const k = crypto.randomUUID();
            appendNode(newConditionNodeData({ x: 0, y: 0 }, k));
          }}
          onAddTelegram={() => {
            const k = crypto.randomUUID();
            appendNode(newTelegramNodeData({ x: 0, y: 0 }, k));
          }}
          onAddTask={(type: TaskType) => {
            const agentId = defaultAgentId || agents[0]?.id || '';
            if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);
            appendNode(newTaskNodeData(type, agentId, { x: 0, y: 0 }, crypto.randomUUID()));
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            defaultEdgeOptions={{
              type: WF_EDGE_TYPE,
              animated: false,
              style: { stroke: 'rgba(164, 230, 255, 0.65)', strokeWidth: 2 },
            }}
            connectionLineStyle={{
              stroke: 'rgba(164, 230, 255, 0.65)',
              strokeWidth: 2,
            }}
            onInit={(inst) => setRfInstance(inst)}
            deleteKeyCode={['Delete', 'Backspace']}
            onNodesChange={(changes) => {
              onNodesChange(changes);
              if (changes.some((c) => c.type === 'remove')) {
                onDirty();
                if (
                  selectedNodeId &&
                  changes.some((c) => c.type === 'remove' && c.id === selectedNodeId)
                ) {
                  setSelectedNodeId(null);
                  setPropertiesOpen(false);
                }
              }
            }}
            edgesFocusable
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((c) => c.type === 'remove' || c.type === 'add')) {
                onDirty();
                if (
                  selectedEdgeId &&
                  changes.some((c) => c.type === 'remove' && c.id === selectedEdgeId)
                ) {
                  setSelectedEdgeId(null);
                  setPropertiesOpen(false);
                }
              }
            }}
            onConnect={onConnect}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
              setPropertiesOpen(true);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
              setEdges((eds) => withEdgeSelection(eds, edge.id));
            }}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={workflowNodeTypes}
            onNodeClick={(_, node) => {
              setSelectedEdgeId(null);
              setSelectedNodeId(node.id);
              setPropertiesOpen(true);
              setNodes((nds) =>
                nds.map((n) => ({ ...n, selected: n.id === node.id })),
              );
              setEdges((eds) => withEdgeSelection(eds, null));
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setPropertiesOpen(false);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
              setEdges((eds) => withEdgeSelection(eds, null));
              onEditorPaneClick?.();
            }}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            minZoom={0.25}
            maxZoom={1.5}
            className="!w-full !h-full bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] bg-[length:20px_20px]"
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} size={1} color="rgba(255,255,255,0.06)" />
            <Controls showInteractive={false} className="!bg-surface-container-high !border-white/10" />
            <MiniMap
              className="!bg-surface-container-high/90 !border-white/10 !rounded-xl"
              nodeColor={(n) => {
                const s = (n.data as WfNodeData).runStatus;
                if (s === 'completed') return '#7dd3a8';
                if (s === 'failed') return '#f87171';
                if (s === 'running') return '#a4e6ff';
                if (s === 'pending') return '#94a3b8';
                if (s === 'skipped') return '#475569';
                return '#64748b';
              }}
              maskColor="rgba(0,0,0,0.6)"
            />
            <Panel position="top-left" className="m-2">
              <button
                type="button"
                onClick={() => setPaletteCollapsed((v) => !v)}
                className="px-2 py-1 rounded-lg bg-surface-container-high/90 border border-white/10 text-[10px] font-bold"
              >
                {paletteCollapsed ? '▶ Palette' : '◀ Palette'}
              </button>
            </Panel>
          </ReactFlow>
          </div>

          <WorkflowExecutionPanel
            open={executionOpen}
            onClose={() => setExecutionOpen(false)}
            running={running}
            result={executionResult}
            workflow={workflow}
            runStatusByStepId={runStatusByStepId}
          />
        </div>

        {propertiesOpen ? (
          <aside className="w-[min(400px,40vw)] border-l border-white/5 bg-surface-container-low/70 flex flex-col shrink-0 backdrop-blur-md">
            <details className="border-b border-white/5 shrink-0 group">
              <summary className="px-4 py-3 cursor-pointer text-[10px] font-mono font-bold uppercase text-on-surface-variant hover:bg-white/5">
                {t('workflows.workflowVariables')}
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[10px] text-on-surface-variant">{t('workflows.workflowVariablesHint')}</p>
                <textarea
                  value={variablesJson}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<string, unknown>;
                      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        onMetaChange({ variables: parsed });
                        onDirty();
                      }
                    } catch {
                      /* ignore while typing */
                    }
                  }}
                  rows={5}
                  placeholder={t('workflows.workflowVariablesPlaceholder')}
                  className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs"
                />
              </div>
            </details>
            {selectedEdgeId ? (
              <WorkflowEdgeInspector
                edge={selectedEdge}
                nodes={nodes as Node<WfNodeData>[]}
                onUpdateBranch={updateSelectedEdgeBranch}
                onDelete={deleteSelectedEdge}
              />
            ) : isTriggerSelected ? (
              <WorkflowTriggerInspector
                draft={entryTrigger}
                workflowActive={workflow.isActive !== false}
                onChange={patchEntryTrigger}
                onNewBotChange={setNewTelegramBot}
              />
            ) : (
              <WorkflowStepInspector
                nodeId={selectedNodeId}
                data={selectedData ?? null}
                agents={agents}
                upstreamOutputKeys={upstreamOutputKeys}
                workflowVarKeys={workflowVarKeys}
                onUpdate={updateSelectedNode}
              />
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
