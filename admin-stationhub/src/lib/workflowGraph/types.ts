import type {
  TaskType,
  WorkflowGraphEdgeStored,
  WorkflowStepConfig,
  WorkflowStepOnFailure,
  WorkflowStepType,
} from '@/src/types/api';

export const WF_TRIGGER_ID = '__trigger__';
export const WF_TRIGGER_KEY = '__trigger__';
export const WF_HANDLE_DEFAULT = 'default';
export const WF_HANDLE_TRUE = 'true';
export const WF_HANDLE_FALSE = 'false';
export const WF_HANDLE_BODY = 'body';
export const WF_HANDLE_DONE = 'done';
export const WF_EDGE_TYPE = 'default' as const;

export type WfGraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
};

export type WorkflowGraphV2Edge = {
  from: string;
  to: string;
  handle?: string;
};

export type WorkflowGraphV2 = {
  version: 2;
  edges: WorkflowGraphV2Edge[];
};

export type WfNodeKind =
  | 'trigger'
  | 'delay'
  | 'task'
  | 'condition'
  | 'loop'
  | 'variable'
  | 'excel'
  | 'telegram';

export function wfChainSourceHandle(kind: WfNodeKind | undefined): string | undefined {
  if (kind === 'condition') return WF_HANDLE_TRUE;
  if (kind === 'loop') return WF_HANDLE_BODY;
  return undefined;
}

export type WfRunStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface WfNodeData {
  kind: WfNodeKind;
  label: string;
  stepType: WorkflowStepType;
  taskType?: TaskType;
  config: WorkflowStepConfig;
  onFailure: WorkflowStepOnFailure;
  runStatus?: WfRunStatus;
  [key: string]: unknown;
}

export function isWorkflowGraphV2(raw: unknown): raw is WorkflowGraphV2 {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as WorkflowGraphV2).version === 2 &&
    Array.isArray((raw as WorkflowGraphV2).edges)
  );
}

export type WfGraphEdgeStored = WorkflowGraphEdgeStored;
