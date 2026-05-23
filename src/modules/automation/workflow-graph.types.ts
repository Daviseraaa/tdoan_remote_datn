export const WF_TRIGGER_KEY = '__trigger__';

export type WorkflowGraphEdge = {
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

export function isWorkflowGraphV2(raw: unknown): raw is WorkflowGraphV2 {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as WorkflowGraphV2).version === 2 &&
    Array.isArray((raw as WorkflowGraphV2).edges)
  );
}
