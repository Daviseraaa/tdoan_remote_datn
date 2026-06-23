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
  AlignHorizontalSpaceAround,
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
  type EntryTriggerPatch,
} from '@/src/lib/workflowEntryTrigger';
import { parseCommittedTelegramVariableArgNames, parseTelegramVariableArgNames } from '@/src/lib/triggerForm';
import { WorkflowEdgeInspector } from './WorkflowEdgeInspector';
import { WorkflowExecutionPanel } from './WorkflowExecutionPanel';
import { WfEditorShortcutsHint } from './WfEditorShortcutsHint';
import { WfAgentSelect } from './WfAgentSelect';
import { MsNumberInput } from './MsNumberInput';
import {
  WF_TRIGGER_ID,
  flowToWorkflowPayload,
  newConditionNodeData,
  newDelayNodeData,
  newLoopNodeData,
  newVariableNodeData,
  newExcelNodeData,
  newTelegramNodeData,
  buildWorkflowNodesFromChromeScript,
  buildWorkflowNodesFromDesktopRecording,
  buildWorkflowNodesFromTaskTemplate,
  buildWorkflowNodesFromWorkflow,
  buildFlowEdge,
  chromeScriptStepToWfNodeData,
  desktopRecordingStepToWfNodeData,
  type BuiltWorkflowNode,
  H_BASE_Y,
  NODE_X_SPACING,
  normalizeGraphPositions,
  newTaskNodeData,
  workflowGraphFingerprint,
  workflowToFlow,
  WF_EDGE_TYPE,
  WF_HANDLE_BODY,
  WF_HANDLE_DONE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  wfChainSourceHandle,
  getUpstreamStepKeys,
  getUpstreamWorkflowVarKeys,
  type UpstreamOutputKey,
  type WfNodeData,
  type WfRunStatus,
  type WfGraphEdge,
  buildClipboardFromNodes,
  pasteClipboard,
  isWorkflowEditorEditableTarget,
  type WfNodeClipboard,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import {
  buildWorkflowConfigFile,
  downloadWorkflowConfigFile,
  parseWorkflowConfigFileText,
} from '@/src/lib/workflowConfigFile';
import type { WorkflowConfigFile } from '@/src/lib/workflowConfigFile';
import { WfWorkflowFileActions } from './WfWorkflowFileActions';
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
        'name' | 'description' | 'cronExpression' | 'isActive' | 'variables' | 'stepDelayMs' | 'closeOpenedOnFinish'
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
  onImportConfigFile?: (file: WorkflowConfigFile) => void;
  onConfigFileError?: (message: string) => void;
  isFullscreen?: boolean;
};

const EDGE_STYLE = { stroke: 'rgba(164, 230, 255, 0.65)', strokeWidth: 2 };
const EDGE_STYLE_SELECTED = { stroke: 'rgba(164, 230, 255, 1)', strokeWidth: 3 };

const WF_CANVAS_CONTROLS_CLS = cn(
  '!static !shadow-none',
  '!bg-transparent !border-0',
  '[&>button]:!bg-black/35 [&>button]:!border [&>button]:!border-white/15',
  '[&>button]:!text-on-surface [&>button]:!rounded-lg [&>button]:backdrop-blur-sm',
  '[&>button:hover]:!bg-white/12 [&>button:hover]:!border-white/25',
  '[&>button_svg]:!fill-current',
);

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
  onImportConfigFile,
  onConfigFileError,
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
  const entryTriggerSyncSig = useRef('');
  const telegramVarNamesRef = useRef<string[]>([]);
  const nodeClipboardRef = useRef<WfNodeClipboard | null>(null);
  const pasteGenerationRef = useRef(0);

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
    nodeClipboardRef.current = null;
    pasteGenerationRef.current = 0;
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
    applyEntryTriggerToCanvas(draft);
    telegramVarNamesRef.current =
      draft.type === 'TELEGRAM'
        ? parseTelegramVariableArgNames(draft.variableArgsText)
        : [];
  }, [workflow.id, graphReloadToken, workflowTriggers, applyEntryTriggerToCanvas]);

  const patchEntryTrigger = useCallback(
    (patch: EntryTriggerPatch) => {
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
        telegramVarNamesRef.current = [];
        onDirty();
        return;
      }

      const { variableArgsCommitted, ...draftPatch } = patch;

      setEntryTrigger((prev) => {
        const next = { ...prev, ...draftPatch };
        applyEntryTriggerToCanvas(next);
        return next;
      });

      const variableArgsText =
        patch.variableArgsText ??
        (variableArgsCommitted ? entryTrigger.variableArgsText : undefined);

      if (variableArgsText !== undefined) {
        const nextType = patch.type ?? entryTrigger.type;
        if (nextType === 'TELEGRAM') {
          const committed = Boolean(variableArgsCommitted);
          const names = parseCommittedTelegramVariableArgNames(
            variableArgsText,
            committed,
          );
          const cur = workflow.variables ?? {};
          const prevManaged = telegramVarNamesRef.current;
          const nextVars = { ...cur };

          if (committed) {
            for (const k of prevManaged) {
              if (!names.includes(k) && k in nextVars) {
                delete nextVars[k];
              }
            }
          }

          for (const k of names) {
            if (!(k in nextVars)) nextVars[k] = '';
          }

          telegramVarNamesRef.current = names;

          const added = names.some((k) => !(k in cur));
          const removed =
            committed && prevManaged.some((k) => !names.includes(k) && k in cur);
          if (added || removed) {
            onMetaChange({ variables: nextVars });
          }
        }
      }

      onDirty();
    },
    [
      applyEntryTriggerToCanvas,
      onDirty,
      queryClient,
      workflow.id,
      workflow.variables,
      entryTrigger.type,
      entryTrigger.variableArgsText,
      onMetaChange,
    ],
  );

  const currentPayload = useCallback(
    () => ({
      ...flowToWorkflowPayload(nodes as Node<WfNodeData>[], edges),
      entryTrigger,
    }),
    [nodes, edges, entryTrigger],
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
      if (kind === 'loop' && handle !== WF_HANDLE_BODY && handle !== WF_HANDLE_DONE) {
        return;
      }
      const dup = edges.some(
        (e) =>
          e.source === conn.source &&
          e.target === conn.target &&
          (e.sourceHandle ?? '') === (conn.sourceHandle ?? ''),
      );
      if (dup) return;
      if (!conn.source || !conn.target) return;

      const edgeId = `e-${conn.source}-${conn.target}-${conn.sourceHandle ?? 'd'}`;
      setEdges((eds) => addEdge(buildFlowEdge(edgeId, conn.source, conn.target, conn.sourceHandle ?? undefined), eds));
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
          const pos = n.id === node.id ? node.position : n.position;
          return {
            ...n,
            position: pos,
            data: {
              ...d,
              config: { ...d.config, ui: { x: pos.x, y: pos.y } },
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
      return;
    }
    setSelectedEdgeId(null);

    const wfNodes = selNodes.filter((n) => n.id !== WF_TRIGGER_ID);
    const triggerOnly =
      selNodes.length === 1 && selNodes[0]?.id === WF_TRIGGER_ID;

    if (triggerOnly) {
      setSelectedNodeId(WF_TRIGGER_ID);
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
      let position = { x: maxX + NODE_X_SPACING, y: H_BASE_Y + (stepCount % 4) * 32 };

      if (chainFromSelected && chainAnchorId) {
        const src = nodes.find((n) => n.id === chainAnchorId);
        if (src) {
          position = { x: src.position.x + NODE_X_SPACING, y: src.position.y };
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
        const handle = wfChainSourceHandle(kind);
        const edgeId = `e-${chainAnchorId}-${id}-${handle ?? 'd'}`;
        setEdges((eds) => [
          ...eds,
          buildFlowEdge(edgeId, chainAnchorId, id, handle),
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
    (source: string, target: string, sourceHandle?: string): Edge =>
      buildFlowEdge(`e-${source}-${target}-${sourceHandle ?? 'd'}`, source, target, sourceHandle),
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
        const handle = wfChainSourceHandle(kind);
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

  const varsContextNodeId = useMemo(() => {
    if (selectedNodeId && selectedNodeId !== WF_TRIGGER_ID) return selectedNodeId;
    if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      return edge?.target ?? null;
    }
    return null;
  }, [selectedNodeId, selectedEdgeId, edges]);

  const upstreamOutputKeys: UpstreamOutputKey[] = useMemo(() => {
    if (!varsContextNodeId) return [];
    return getUpstreamStepKeys(
      varsContextNodeId,
      graphEdgesForUpstream,
      nodes.map((n) => ({ id: n.id, data: n.data as WfNodeData })),
    );
  }, [varsContextNodeId, graphEdgesForUpstream, nodes]);

  const showTelegramVars = entryTrigger.type === 'TELEGRAM';

  const telegramVarArgKeys = useMemo(
    () =>
      entryTrigger.type === 'TELEGRAM'
        ? parseTelegramVariableArgNames(entryTrigger.variableArgsText)
        : [],
    [entryTrigger.type, entryTrigger.variableArgsText],
  );

  const workflowVarKeys = useMemo(() => {
    if (!varsContextNodeId) {
      return [...new Set([...Object.keys(workflow.variables ?? {}), ...telegramVarArgKeys])];
    }
    return getUpstreamWorkflowVarKeys(
      varsContextNodeId,
      graphEdgesForUpstream,
      nodes.map((n) => ({ id: n.id, data: n.data as WfNodeData })),
      workflow.variables,
      telegramVarArgKeys,
    );
  }, [
    varsContextNodeId,
    graphEdgesForUpstream,
    nodes,
    workflow.variables,
    telegramVarArgKeys,
  ]);

  const handleVariablesChange = useCallback(
    (variables: Record<string, unknown>) => {
      onMetaChange({ variables });
      onDirty();
    },
    [onMetaChange, onDirty],
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

  const handleDefaultAgentChange = useCallback(
    (nextId: string) => {
      if (nextId === defaultAgentId) return;
      onDefaultAgentIdChange(nextId);
      setNodes((nds) =>
        nds.map((n) => {
          const data = n.data as WfNodeData;
          if (data.kind !== 'task') return n;
          return {
            ...n,
            data: {
              ...data,
              config: { ...data.config, agentId: nextId },
            },
          };
        }),
      );
      onDirty();
    },
    [defaultAgentId, onDefaultAgentIdChange, setNodes, onDirty],
  );

  const handleStepAgentChange = useCallback(
    (agentId: string) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const prev = n.data as WfNodeData;
          if (prev.kind !== 'task') return n;
          return {
            ...n,
            data: {
              ...prev,
              config: { ...prev.config, agentId },
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
  const hideDeleteInToolbar =
    multiSelectCount >= 1 ||
    (propertiesOpen &&
      (Boolean(selectedEdgeId) ||
        (Boolean(selectedNodeId) && selectedNodeId !== WF_TRIGGER_ID)));

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

  const resolveCopyNodeIds = useCallback((): string[] => {
    const ids = new Set<string>(selectedWfNodeIds);
    if (ids.size === 0 && selectedNodeId && selectedNodeId !== WF_TRIGGER_ID) {
      ids.add(selectedNodeId);
    }
    return Array.from(ids);
  }, [selectedNodeId, selectedWfNodeIds]);

  const copySelectedNodes = useCallback(() => {
    const ids = new Set(resolveCopyNodeIds());
    if (ids.size === 0) return;
    const selected = nodes.filter((n) => ids.has(n.id)) as Node<WfNodeData>[];
    const clip = buildClipboardFromNodes(selected, edges);
    if (!clip) return;
    nodeClipboardRef.current = clip;
    pasteGenerationRef.current = 0;
  }, [edges, nodes, resolveCopyNodeIds]);

  const pasteCopiedNodes = useCallback(() => {
    const clip = nodeClipboardRef.current;
    if (!clip || clip.nodes.length === 0) return;
    pasteGenerationRef.current += 1;
    const { nodes: pastedNodes, edges: pastedEdges } = pasteClipboard(
      clip,
      pasteGenerationRef.current,
    );
    const lastId = pastedNodes[pastedNodes.length - 1]?.id ?? null;
    setNodes((nds) => [
      ...nds.map((n) => ({ ...n, selected: false })),
      ...pastedNodes,
    ]);
    setEdges((eds) => [...eds, ...pastedEdges]);
    setSelectedEdgeId(null);
    setSelectedNodeId(lastId);
    setPropertiesOpen(Boolean(lastId));
    onDirty();
  }, [onDirty, setEdges, setNodes]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isWorkflowEditorEditableTarget(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        if (resolveCopyNodeIds().length === 0) return;
        e.preventDefault();
        copySelectedNodes();
      } else if (key === 'v') {
        if (!nodeClipboardRef.current) return;
        e.preventDefault();
        pasteCopiedNodes();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [copySelectedNodes, pasteCopiedNodes, resolveCopyNodeIds]);

  const updateSelectedEdgeBranch = useCallback(
    (handle: string) => {
      if (!selectedEdgeId) return;
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (!edge) return;
      const nextId = `e-${edge.source}-${edge.target}-${handle}`;
      const label =
        handle === WF_HANDLE_TRUE
          ? t('workflows.branchTrue')
          : handle === WF_HANDLE_FALSE
            ? t('workflows.branchFalse')
            : handle === WF_HANDLE_BODY
              ? t('workflows.branchBody')
              : handle === WF_HANDLE_DONE
                ? t('workflows.branchDone')
                : undefined;
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== selectedEdgeId) return e;
          return {
            ...e,
            id: nextId,
            sourceHandle: handle,
            label,
            labelStyle: label
              ? { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 }
              : undefined,
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

  const handleNormalizeLayout = useCallback(() => {
    const stepNodes = nodes.filter((n) => n.id !== WF_TRIGGER_ID);
    if (stepNodes.length === 0) return;

    const stepIds = stepNodes.map((n) => n.id);
    const orderFallback = new Map(stepIds.map((id, i) => [id, i]));
    const graphEdges: WfGraphEdge[] = edges
      .filter((e) => e.source && e.target)
      .map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle ?? undefined,
      }));

    const nodeMeta = new Map(
      stepNodes.map((n) => {
        const d = n.data as WfNodeData;
        return [n.id, { label: d.label, subtitle: d.stepType }] as const;
      }),
    );

    const positions = normalizeGraphPositions(stepIds, graphEdges, orderFallback, nodeMeta);

    setNodes((nds) =>
      nds.map((n) => {
        const pos = positions.get(n.id);
        if (!pos) return n;
        const d = n.data as WfNodeData;
        return {
          ...n,
          position: { ...pos },
          data: {
            ...d,
            config: { ...d.config, ui: { x: pos.x, y: pos.y } },
          },
        };
      }),
    );
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPropertiesOpen(false);
    onDirty();
    requestAnimationFrame(() => {
      rfInstance?.fitView({ padding: 0.15 });
    });
  }, [nodes, edges, setNodes, onDirty, rfInstance]);

  const handleExportConfig = useCallback(() => {
    const { steps, graph } = flowToWorkflowPayload(nodes as Node<WfNodeData>[], edges);
    const file = buildWorkflowConfigFile(workflow, { steps, graph });
    downloadWorkflowConfigFile(file);
  }, [nodes, edges, workflow]);

  const handleImportConfigFile = useCallback(
    async (picked: File) => {
      if (!onImportConfigFile) return;
      try {
        const text = await picked.text();
        const parsed = parseWorkflowConfigFileText(text);
        if (isDirty) {
          const ok = window.confirm(t('workflows.configFile.importReplaceConfirm'));
          if (!ok) return;
        }
        onImportConfigFile(parsed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : t('workflows.configFile.invalidShape');
        onConfigFileError?.(msg);
      }
    },
    [isDirty, onConfigFileError, onImportConfigFile],
  );

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
            onChange={handleDefaultAgentChange}
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
            <MsNumberInput
              value={workflow.stepDelayMs ?? 0}
              onChange={(ms) => onMetaChange({ stepDelayMs: ms })}
              className="w-14 text-[10px] px-1.5 py-1 rounded-lg bg-black/20 border border-white/10 font-mono shrink-0"
            />
          </label>

          <label
            className="hidden lg:flex items-center gap-2 text-xs font-bold text-on-surface-variant cursor-pointer shrink-0"
            title={t('workflows.closeOpenedOnFinishHint')}
          >
            <input
              type="checkbox"
              checked={workflow.closeOpenedOnFinish ?? false}
              onChange={(e) => onMetaChange({ closeOpenedOnFinish: e.target.checked })}
              className="rounded"
            />
            {t('workflows.closeOpenedOnFinish')}
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

          {onImportConfigFile ? (
            <WfWorkflowFileActions
              onExport={handleExportConfig}
              onImportFile={handleImportConfigFile}
              disabled={saving || running}
            />
          ) : null}

          {canDeleteSelection && !hideDeleteInToolbar ? (
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
            disabled={saving || running || nodes.filter((n) => n.id !== WF_TRIGGER_ID).length === 0}
            onClick={handleNormalizeLayout}
            title={t('workflows.normalizeLayoutHint')}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-white/12 text-on-surface-variant hover:bg-white/5 hover:text-on-surface disabled:opacity-40 shrink-0"
          >
            <AlignHorizontalSpaceAround size={14} />
            <span className="hidden sm:inline">{t('workflows.normalizeLayout')}</span>
          </button>

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
          onAddLoop={() => {
            const k = crypto.randomUUID();
            appendNode(newLoopNodeData({ x: 0, y: 0 }, k));
          }}
          onAddVarCreate={() => {
            const k = crypto.randomUUID();
            appendNode(newVariableNodeData('create', { x: 0, y: 0 }, k));
          }}
          onAddVarRead={() => {
            const k = crypto.randomUUID();
            appendNode(newVariableNodeData('read', { x: 0, y: 0 }, k));
          }}
          onAddVarSet={() => {
            const k = crypto.randomUUID();
            appendNode(newVariableNodeData('set', { x: 0, y: 0 }, k));
          }}
          onAddExcelRead={() => {
            const k = crypto.randomUUID();
            const agentId = defaultAgentId || agents[0]?.id || '';
            if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);
            appendNode(newExcelNodeData('read', agentId, { x: 0, y: 0 }, k));
          }}
          onAddExcelWrite={() => {
            const k = crypto.randomUUID();
            const agentId = defaultAgentId || agents[0]?.id || '';
            if (!defaultAgentId && agents[0]) onDefaultAgentIdChange(agents[0].id);
            appendNode(newExcelNodeData('write', agentId, { x: 0, y: 0 }, k));
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
              interactionWidth: 24,
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
              setSelectedEdgeId(null);
              setSelectedNodeId(node.id);
              setPropertiesOpen(true);
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
            onNodeDragStart={() => setPropertiesOpen(false)}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={workflowNodeTypes}
            onPaneClick={() => {
              onEditorPaneClick?.();
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setPropertiesOpen(false);
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
            <Panel
              position="bottom-left"
              className="!m-2 !mb-2 !z-40 flex flex-col items-start gap-2 pointer-events-none [&_button]:pointer-events-auto"
            >
              <div className="pointer-events-auto">
                <Controls showInteractive={false} className={WF_CANVAS_CONTROLS_CLS} />
              </div>
              <WfEditorShortcutsHint />
            </Panel>
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
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {selectedEdgeId ? (
                <WorkflowEdgeInspector
                  edge={selectedEdge}
                  nodes={nodes as Node<WfNodeData>[]}
                  workflowId={workflow.id}
                  workflowVariables={workflow.variables}
                  onWorkflowVariablesChange={handleVariablesChange}
                  upstreamOutputKeys={upstreamOutputKeys}
                  workflowVarKeys={workflowVarKeys}
                  showTelegramVars={showTelegramVars}
                  onUpdateBranch={updateSelectedEdgeBranch}
                  onDelete={deleteSelectedEdge}
                />
              ) : isTriggerSelected ? (
                <WorkflowTriggerInspector
                  draft={entryTrigger}
                  workflowActive={workflow.isActive !== false}
                  workflowId={workflow.id}
                  workflowVariables={workflow.variables}
                  workflowVarKeys={workflowVarKeys}
                  onWorkflowVariablesChange={handleVariablesChange}
                  onChange={patchEntryTrigger}
                />
              ) : (
                <WorkflowStepInspector
                  nodeId={selectedNodeId}
                  data={selectedData ?? null}
                  agents={agents}
                  workflowId={workflow.id}
                  workflowVariables={workflow.variables}
                  onWorkflowVariablesChange={handleVariablesChange}
                  workflowStepDelayMs={workflow.stepDelayMs ?? 0}
                  upstreamOutputKeys={upstreamOutputKeys}
                  workflowVarKeys={workflowVarKeys}
                  showTelegramVars={showTelegramVars}
                  onUpdate={updateSelectedNode}
                  onAgentChange={handleStepAgentChange}
                  onDelete={deleteSelectedNodes}
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
              </div>
            </aside>
            </>
          ) : null}

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
    </div>
  );
}
