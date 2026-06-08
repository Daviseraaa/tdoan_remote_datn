import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import {
  PlayCircle,
  Save,
  Loader2,
  AlertTriangle,
  PanelLeftOpen,
  Trash2,
  X,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
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
  buildWorkflowNodesFromChromeScript,
  buildWorkflowNodesFromDesktopRecording,
  buildWorkflowNodesFromTaskTemplate,
  buildWorkflowNodesFromWorkflow,
  chromeScriptStepToWfNodeData,
  desktopRecordingStepToWfNodeData,
  type BuiltWorkflowNode,
  NODE_X_SPACING,
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
import {
  actionLabel as chromeActionLabel,
  newChromeStep,
  summarizeStep as summarizeChromeStep,
  type ChromeScriptAction,
} from '@/src/lib/chromeScriptSteps';
import {
  actionLabel as desktopActionLabel,
  summarizeStep as summarizeDesktopStep,
  type DesktopAction,
} from '@/src/lib/desktopRecordingSteps';
import { newDesktopStep } from '@/src/lib/taskTemplatePayload';
import type {
  Agent,
  ChromeScript,
  DesktopRecording,
  ExecuteWorkflowResult,
  TaskTemplate,
  TaskType,
  Workflow,
} from '@/src/types/api';
import type { WorkflowSavePayload } from '@/src/hooks/useWorkflowEditor';

type Props = {
  workflow: Workflow;
  agents: Agent[];
  defaultAgentId: string;
  onDefaultAgentIdChange: (id: string) => void;
  onMetaChange: (
    patch: Partial<
      Pick<
        Workflow,
        'name' | 'description' | 'cronExpression' | 'isActive' | 'variables' | 'stepDelayMs'
      >
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
  onBack?: () => void;
  onEditorPaneClick?: () => void;
  onDeleteWorkflow?: () => void;
  isFullscreen?: boolean;
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
  onBack,
  onEditorPaneClick,
  onDeleteWorkflow,
  isFullscreen = false,
}: Props) {
  const isLgUp = useMediaQuery('(min-width: 1024px)');
  const queryClient = useQueryClient();
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [executionOpen, setExecutionOpen] = useState(false);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<{ fitView: (o?: { padding?: number }) => void } | null>(
    null,
  );
  const [entryTrigger, setEntryTrigger] = useState<EntryTriggerDraft>(() => defaultEntryTriggerDraft());
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

  const flowEdges = useMemo(
    () => withEdgeSelection(edges, selectedEdgeId),
    [edges, selectedEdgeId],
  );

  const selectedWfNodeIds = useMemo(
    () => nodes.filter((n) => n.selected && n.id !== WF_TRIGGER_ID).map((n) => n.id),
    [nodes],
  );
  const multiSelectCount = selectedWfNodeIds.length;

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
      if (patch.type === 'MANUAL') {
        setEntryTrigger((prev) => {
          if (prev.triggerId) {
            void triggersApi.deleteTrigger(prev.triggerId).then(() => {
              void queryClient.invalidateQueries({ queryKey: ['workflow-triggers', workflow.id] });
            });
          }
          const cleared: EntryTriggerDraft = { ...defaultEntryTriggerDraft(), type: 'MANUAL' };
          applyEntryTriggerToCanvas(cleared);
          return cleared;
        });
        onDirty();
        return;
      }

      setEntryTrigger((prev) => {
        const next = { ...prev, ...patch };
        applyEntryTriggerToCanvas(next);
        return next;
      });
      onDirty();
    },
    [applyEntryTriggerToCanvas, onDirty, queryClient, workflow.id],
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
          if (!n.selected && n.id !== node.id) return n;
          const d = n.data as WfNodeData;
          return {
            ...n,
            position: n.id === node.id ? node.position : n.position,
            data: {
              ...d,
              config: { ...d.config, ui: { x: n.position.x, y: n.position.y } },
            },
          };
        }),
      );
      onDirty();
    },
    [setNodes, onDirty],
  );

  const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }: OnSelectionChangeParams) => {
    if (selEdges.length > 0) {
      const edgeId = selEdges[selEdges.length - 1]?.id ?? null;
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
      setPropertiesOpen(true);
      return;
    }
    setSelectedEdgeId(null);

    const wfNodes = selNodes.filter((n) => n.id !== WF_TRIGGER_ID);
    const triggerOnly =
      selNodes.length === 1 && selNodes[0]?.id === WF_TRIGGER_ID;

    if (triggerOnly) {
      setSelectedNodeId(WF_TRIGGER_ID);
      setPropertiesOpen(true);
      return;
    }
    if (wfNodes.length === 0) {
      setSelectedNodeId(null);
      setPropertiesOpen(false);
      return;
    }
    if (wfNodes.length > 1) {
      setSelectedNodeId(wfNodes[wfNodes.length - 1]!.id);
      setPropertiesOpen(false);
      return;
    }
    setSelectedNodeId(wfNodes[0]!.id);
    setPropertiesOpen(true);
  }, []);

  const maxX = useMemo(() => {
    const xs = nodes.map((n) => n.position.x);
    return xs.length ? Math.max(...xs) : 48;
  }, [nodes]);

  const appendNode = useCallback(
    (data: WfNodeData) => {
      const chainAnchorId = selectedWfNodeIds.length === 1 ? selectedWfNodeIds[0] : null;
      const chainFromSelected =
        propertiesOpen && Boolean(chainAnchorId) && !selectedEdgeId;

      const stepKey = crypto.randomUUID();
      const id = stepKey;
      const stepCount = nodes.filter((n) => n.id !== WF_TRIGGER_ID).length;
      let position = { x: maxX + 300, y: 220 + (stepCount % 4) * 48 };

      if (chainFromSelected && chainAnchorId) {
        const src = nodes.find((n) => n.id === chainAnchorId);
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

      if (chainFromSelected && chainAnchorId) {
        const srcNode = nodes.find((n) => n.id === chainAnchorId);
        const kind = (srcNode?.data as WfNodeData | undefined)?.kind;
        const handle = kind === 'condition' ? WF_HANDLE_TRUE : undefined;
        const edgeId = `e-${chainAnchorId}-${id}-${handle ?? 'd'}`;
        setEdges((eds) => [
          ...eds,
          {
            id: edgeId,
            source: chainAnchorId,
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
        ]);
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
    [nodes, maxX, propertiesOpen, selectedWfNodeIds, selectedEdgeId, setNodes, setEdges, onDirty],
  );

  const makeWorkflowEdge = useCallback(
    (source: string, target: string, sourceHandle?: string): Edge => {
      const edgeId = `e-${source}-${target}-${sourceHandle ?? 'd'}`;
      return {
        id: edgeId,
        source,
        target,
        sourceHandle,
        type: WF_EDGE_TYPE,
        animated: false,
        style: EDGE_STYLE,
        label:
          sourceHandle === WF_HANDLE_TRUE
            ? t('workflows.branchTrue')
            : sourceHandle === WF_HANDLE_FALSE
              ? t('workflows.branchFalse')
              : undefined,
        labelStyle: sourceHandle
          ? { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 }
          : undefined,
      };
    },
    [],
  );

  const applyBuiltWorkflowNodes = useCallback(
    (built: BuiltWorkflowNode[], opts?: { anchorNodeId?: string }) => {
      if (built.length === 0) return;

      const anchorId = opts?.anchorNodeId;
      const anchorNode = anchorId ? nodes.find((n) => n.id === anchorId) : undefined;

      if (anchorId && anchorNode) {
        const [first, ...rest] = built;
        const lastId = rest.length > 0 ? rest[rest.length - 1]!.stepKey : anchorId;
        const pos = anchorNode.position;

        const extraNodes: Node<WfNodeData>[] = rest.map((item, i) => ({
          id: item.stepKey,
          type: 'wfNode',
          position: { x: pos.x + (i + 1) * NODE_X_SPACING, y: pos.y },
          data: {
            ...item.data,
            config: {
              ...item.data.config,
              stepKey: item.stepKey,
              ui: { x: pos.x + (i + 1) * NODE_X_SPACING, y: pos.y },
            },
          },
          selected: i === rest.length - 1,
        }));

        setNodes((nds) =>
          nds
            .map((n) => {
              if (n.id !== anchorId) {
                return { ...n, selected: false };
              }
              return {
                ...n,
                selected: rest.length === 0,
                data: {
                  ...first.data,
                  config: {
                    ...first.data.config,
                    stepKey: anchorId,
                    ui: { x: pos.x, y: pos.y },
                  },
                },
              };
            })
            .concat(extraNodes),
        );

        setEdges((eds) => {
          const outFromAnchor = eds.filter((e) => e.source === anchorId);
          const kept = eds.filter((e) => e.source !== anchorId);
          const chain: Edge[] = [];
          let prev = anchorId;
          for (const item of rest) {
            chain.push(makeWorkflowEdge(prev, item.stepKey));
            prev = item.stepKey;
          }
          const remapped = outFromAnchor.map((e) =>
            makeWorkflowEdge(lastId, e.target, e.sourceHandle ?? undefined),
          );
          return [...kept, ...chain, ...remapped];
        });
        setSelectedEdgeId(null);
        setSelectedNodeId(lastId);
        setPropertiesOpen(true);
        onDirty();
        return;
      }

      const chainAnchorId = selectedWfNodeIds.length === 1 ? selectedWfNodeIds[0] : null;
      const chainFromSelected =
        propertiesOpen && Boolean(chainAnchorId) && !selectedEdgeId;

      const stepCount = nodes.filter((n) => n.id !== WF_TRIGGER_ID).length;
      let baseX = maxX + NODE_X_SPACING;
      let baseY = 220 + (stepCount % 4) * 48;
      let connectFrom: string | null = null;

      if (chainFromSelected && chainAnchorId) {
        const src = nodes.find((n) => n.id === chainAnchorId);
        if (src) {
          baseX = src.position.x + NODE_X_SPACING;
          baseY = src.position.y;
          connectFrom = chainAnchorId;
        }
      }

      const newNodes: Node<WfNodeData>[] = built.map((item, i) => ({
        id: item.stepKey,
        type: 'wfNode',
        position: { x: baseX + i * NODE_X_SPACING, y: baseY },
        data: {
          ...item.data,
          config: {
            ...item.data.config,
            stepKey: item.stepKey,
            ui: { x: baseX + i * NODE_X_SPACING, y: baseY },
          },
        },
        selected: i === built.length - 1,
      }));

      const newEdges: Edge[] = [];
      if (connectFrom) {
        const srcNode = nodes.find((n) => n.id === connectFrom);
        const kind = (srcNode?.data as WfNodeData | undefined)?.kind;
        const handle = kind === 'condition' ? WF_HANDLE_TRUE : undefined;
        newEdges.push(makeWorkflowEdge(connectFrom, built[0]!.stepKey, handle));
      }
      for (let i = 0; i < built.length - 1; i++) {
        newEdges.push(makeWorkflowEdge(built[i]!.stepKey, built[i + 1]!.stepKey));
      }

      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        ...newNodes,
      ]);
      setEdges((eds) => [...eds, ...newEdges]);
      setSelectedEdgeId(null);
      setSelectedNodeId(newNodes[newNodes.length - 1]!.id);
      setPropertiesOpen(true);
      onDirty();
    },
    [
      makeWorkflowEdge,
      maxX,
      nodes,
      onDirty,
      propertiesOpen,
      selectedEdgeId,
      selectedWfNodeIds,
    ],
  );

  const importChromeScript = useCallback(
    (script: ChromeScript, opts?: { anchorNodeId?: string }) => {
      const agentId = script.agentId || defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;
      if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);

      const built = buildWorkflowNodesFromChromeScript(script, agentId);
      applyBuiltWorkflowNodes(built, opts);
    },
    [agents, applyBuiltWorkflowNodes, defaultAgentId, onDefaultAgentIdChange],
  );

  const importDesktopRecording = useCallback(
    (recording: DesktopRecording, opts?: { anchorNodeId?: string }) => {
      const agentId = recording.agentId || defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;
      if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);

      const built = buildWorkflowNodesFromDesktopRecording(recording, agentId);
      applyBuiltWorkflowNodes(built, opts);
    },
    [agents, applyBuiltWorkflowNodes, defaultAgentId, onDefaultAgentIdChange],
  );

  const importTaskTemplate = useCallback(
    (template: TaskTemplate, opts?: { anchorNodeId?: string }) => {
      const agentId = template.agentId || defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;
      if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);

      const built = buildWorkflowNodesFromTaskTemplate(template, agentId);
      applyBuiltWorkflowNodes(built, opts);
    },
    [agents, applyBuiltWorkflowNodes, defaultAgentId, onDefaultAgentIdChange],
  );

  const importWorkflow = useCallback(
    (source: Workflow, opts?: { anchorNodeId?: string }) => {
      const agentId = defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;

      const built = buildWorkflowNodesFromWorkflow(source, agentId);
      applyBuiltWorkflowNodes(built, opts);
    },
    [agents, applyBuiltWorkflowNodes, defaultAgentId],
  );

  const addChromeStep = useCallback(
    (action: ChromeScriptAction) => {
      const agentId = defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;
      if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);
      const step = newChromeStep(action);
      const label = `${chromeActionLabel(step.action)}: ${summarizeChromeStep(step)}`;
      appendNode(
        chromeScriptStepToWfNodeData(step, agentId, undefined, label, crypto.randomUUID()),
      );
    },
    [agents, appendNode, defaultAgentId, onDefaultAgentIdChange],
  );

  const addDesktopStep = useCallback(
    (action: DesktopAction) => {
      const agentId = defaultAgentId || agents[0]?.id || '';
      if (!agentId) return;
      if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);
      const step = newDesktopStep(action);
      const label = `${desktopActionLabel(step.action)}: ${summarizeDesktopStep(step)}`;
      appendNode(
        desktopRecordingStepToWfNodeData(step, agentId, label, crypto.randomUUID()),
      );
    },
    [agents, appendNode, defaultAgentId, onDefaultAgentIdChange],
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

  const canDeleteNode = multiSelectCount > 0;
  const canDeleteEdge = Boolean(selectedEdgeId);
  const canDeleteSelection = canDeleteNode || canDeleteEdge;

  const deleteSelectedNodes = useCallback(() => {
    const ids = new Set(selectedWfNodeIds);
    if (ids.size === 0) return;
    setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPropertiesOpen(false);
    onDirty();
  }, [selectedWfNodeIds, setNodes, setEdges, onDirty]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    setPropertiesOpen(false);
    onDirty();
  }, [selectedEdgeId, setEdges, onDirty]);

  const deleteSelection = useCallback(() => {
    if (selectedEdgeId) deleteSelectedEdge();
    else deleteSelectedNodes();
  }, [selectedEdgeId, deleteSelectedEdge, deleteSelectedNodes]);

  const updateSelectedEdgeBranch = useCallback(
    (handle: typeof WF_HANDLE_TRUE | typeof WF_HANDLE_FALSE) => {
      if (!selectedEdgeId) return;
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return;
      const nextId = `e-${edge.source}-${edge.target}-${handle}`;
      setEdges((eds) =>
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
      );
      setSelectedEdgeId(nextId);
      onDirty();
    },
    [selectedEdgeId, edges, setEdges, onDirty],
  );

  const handleSave = () => void onSave(currentPayload());
  const handleRun = () => void onRun(currentPayload());

  return (
    <div className="w-full min-h-[70dvh] lg:h-full lg:min-h-0 flex flex-col overflow-hidden bg-surface-container-lowest">
      <header className="shrink-0 border-b border-white/5 bg-surface-container-low/30">
        <div className="px-3 py-2 flex flex-wrap items-center gap-2 border-b border-white/5">
          <div className="w-full sm:flex-1 sm:min-w-[12rem] min-w-0 order-2 sm:order-1">
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
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400/90 px-2 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20 order-1 sm:order-2 shrink-0">
              <AlertTriangle size={12} />
              {t('workflows.unsavedChanges')}
            </span>
          ) : null}

          {detailLoading ? (
            <span className="text-[10px] font-mono text-primary flex items-center gap-1 order-1 sm:order-3 shrink-0">
              <Loader2 size={12} className="animate-spin" />
              {t('workflows.loadingDetail')}
            </span>
          ) : null}

          {error ? (
            <span
              className="text-[10px] text-error max-w-[200px] truncate order-1 sm:order-4 shrink-0"
              title={error}
            >
              {error}
            </span>
          ) : null}
        </div>

        <div className="px-3 py-2 flex flex-wrap items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 shrink-0"
              title={t('workflows.backToList')}
            >
              <ArrowLeft size={14} />
              <span className="truncate max-w-[8rem] sm:max-w-none">{t('workflows.backToList')}</span>
            </button>
          ) : onOpenWorkflowList ? (
            <button
              type="button"
              onClick={onOpenWorkflowList}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 shrink-0"
              title={t('workflows.showWorkflowList')}
            >
              <PanelLeftOpen size={14} />
              <span className="truncate max-w-[8rem] sm:max-w-none">{t('workflows.showWorkflowList')}</span>
            </button>
          ) : null}
          <WfAgentSelect
            value={defaultAgentId}
            onChange={onDefaultAgentIdChange}
            agents={agents}
            className="w-full sm:w-[min(200px,40vw)] shrink-0"
            title={t('workflows.defaultAgent')}
            placeholder={t('workflows.selectDefaultAgent')}
          />

          <label
            className="hidden md:flex items-center gap-1.5 shrink-0 min-w-0"
            title={t('workflows.stepDelayMsHint')}
          >
            <span className="text-[10px] font-bold text-on-surface-variant whitespace-nowrap">
              {t('workflows.stepDelayMs')}
            </span>
            <input
              type="number"
              min={0}
              step={100}
              value={workflow.stepDelayMs ?? 0}
              onChange={(e) =>
                onMetaChange({ stepDelayMs: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-14 text-[10px] px-1.5 py-1 rounded-lg bg-black/20 border border-white/10 font-mono shrink-0"
            />
          </label>

          <label className="hidden sm:flex items-center gap-2 text-xs font-bold text-on-surface-variant cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={workflow.isActive}
              onChange={(e) => onMetaChange({ isActive: e.target.checked })}
              className="rounded"
            />
            {t('workflows.isActive')}
          </label>

          <div className="hidden lg:block flex-1" />

          {canDeleteSelection ? (
            <button
              type="button"
              onClick={deleteSelection}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-error/30 text-error hover:bg-error/10 shrink-0"
              title={`${selectedEdgeId ? t('workflows.deleteEdge') : multiSelectCount > 1 ? t('workflows.deleteNodes', { count: String(multiSelectCount) }) : t('workflows.deleteNode')} (${t('workflows.deleteNodeShortcut')})`}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">
              {selectedEdgeId
                ? t('workflows.deleteEdge')
                : multiSelectCount > 1
                  ? t('workflows.deleteNodes', { count: String(multiSelectCount) })
                  : t('workflows.deleteNode')}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-primary/20 text-primary border border-primary/30 disabled:opacity-40 shrink-0"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline">{saveOk ? t('common.saved') : t('workflows.saveWorkflow')}</span>
          </button>

          <button
            type="button"
            disabled={running || saving}
            onClick={() => void handleRun()}
            className={cn(
              'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold shrink-0',
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
            <span className="hidden sm:inline">
              {running ? t('workflows.executionRunning') : t('workflows.runWorkflow')}
            </span>
          </button>

          {onDeleteWorkflow ? (
            <button
              type="button"
              onClick={onDeleteWorkflow}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-error/30 text-error hover:bg-error/10 shrink-0"
              title={t('workflows.deleteWorkflow')}
            >
              <Trash2 size={14} />
              <span className="hidden md:inline">{t('workflows.deleteWorkflow')}</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex-1 flex min-h-[55dvh] lg:min-h-0 overflow-hidden">
        <WorkflowNodePalette
          collapsed={paletteCollapsed || !isLgUp}
          chainNextStep={
            propertiesOpen && multiSelectCount === 1 && !selectedEdgeId
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
          onImportChromeScript={importChromeScript}
          onImportDesktopRecording={importDesktopRecording}
          onImportTaskTemplate={importTaskTemplate}
          onImportWorkflow={importWorkflow}
          onAddChromeStep={addChromeStep}
          onAddDesktopStep={addDesktopStep}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          <div className="flex-1 min-h-0 w-full relative">
          <ReactFlow
            nodes={nodes}
            edges={flowEdges}
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
            selectionKeyCode="Alt"
            selectionMode={SelectionMode.Partial}
            multiSelectionKeyCode="Alt"
            panOnDrag
            onSelectionChange={onSelectionChange}
            onNodeClick={(_, node) => {
              if (node.id === WF_TRIGGER_ID) {
                setSelectedEdgeId(null);
                setSelectedNodeId(WF_TRIGGER_ID);
                setPropertiesOpen(true);
              }
            }}
            onBeforeDelete={async ({ nodes: nodesToDelete, edges: edgesToDelete }) => ({
              nodes: nodesToDelete.filter((n) => n.id !== WF_TRIGGER_ID),
              edges: edgesToDelete,
            })}
            onNodesChange={(changes) => {
              const safe = changes.filter(
                (c) => !(c.type === 'remove' && c.id === WF_TRIGGER_ID),
              );
              onNodesChange(safe);
              if (safe.some((c) => c.type === 'remove')) {
                onDirty();
                const removed = new Set(
                  safe.filter((c) => c.type === 'remove').map((c) => c.id),
                );
                if (selectedNodeId && removed.has(selectedNodeId)) {
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
            }}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={workflowNodeTypes}
            onPaneClick={() => {
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
              className="!hidden md:!block !bg-surface-container-high/90 !border-white/10 !rounded-xl"
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

          {propertiesOpen ? (
            <>
              <div
                className="absolute inset-0 z-10 bg-black/40 lg:hidden"
                onClick={() => setPropertiesOpen(false)}
                aria-hidden
              />
            <aside className="absolute inset-y-0 right-0 z-20 w-full sm:max-w-md lg:w-[min(400px,40vw)] border-l border-white/5 bg-surface-container-low/95 flex flex-col backdrop-blur-md shadow-[-8px_0_24px_rgba(0,0,0,0.2)] min-w-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 shrink-0 lg:hidden">
                <span className="text-xs font-bold">{t('workflows.properties')}</span>
                <button
                  type="button"
                  onClick={() => setPropertiesOpen(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg text-on-surface-variant"
                  aria-label={t('workflows.closeProperties')}
                >
                  <X size={16} />
                </button>
              </div>
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
                  workflowStepDelayMs={workflow.stepDelayMs ?? 0}
                  upstreamOutputKeys={upstreamOutputKeys}
                  workflowVarKeys={workflowVarKeys}
                  onUpdate={updateSelectedNode}
                onImportChromeScript={(script) =>
                  importChromeScript(script, {
                    anchorNodeId:
                      selectedData?.taskType === 'CHROME_EXTENSION'
                        ? selectedNodeId ?? undefined
                        : undefined,
                  })
                }
                onImportDesktopRecording={(rec) =>
                  importDesktopRecording(rec, {
                    anchorNodeId: selectedNodeId ?? undefined,
                  })
                }
                onImportTaskTemplate={(tpl) =>
                  importTaskTemplate(tpl, {
                    anchorNodeId: selectedNodeId ?? undefined,
                  })
                }
                onImportWorkflow={(wf) =>
                  importWorkflow(wf, {
                    anchorNodeId: selectedNodeId ?? undefined,
                  })
                }
                />
              )}
            </aside>
            </>
          ) : null}
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
      </div>
    </div>
  );
}
