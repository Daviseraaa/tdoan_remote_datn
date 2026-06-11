import type { WfRunStatus } from '@/src/lib/workflowGraph';
import { stepRuntimeKey } from '@/src/lib/workflowGraph';
import type {
  StepRunStatus,
  Workflow,
  WorkflowRunStatus,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowStepRun,
  WorkflowStepRunOutput,
} from '@/src/types/api';

function parseStepRunOutput(raw: unknown): WorkflowStepRunOutput | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as WorkflowStepRunOutput;
}

export function stepKeyForStep(
  step: { id?: string; order: number; config?: unknown },
): string {
  const cfg = step.config as { stepKey?: string } | undefined;
  return cfg?.stepKey ?? step.id ?? `step-${step.order}`;
}

export function sortStepRuns(stepRuns: WorkflowStepRun[]): WorkflowStepRun[] {
  return [...stepRuns].sort((a, b) => {
    const pathA = a.flowPath ?? '';
    const pathB = b.flowPath ?? '';
    if (pathA !== pathB) return pathA.localeCompare(pathB);
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.order - b.order;
  });
}

export function stepRunToWfStatus(status: StepRunStatus): WfRunStatus {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'RUNNING':
      return 'running';
    case 'PENDING':
      return 'pending';
    case 'SKIPPED':
      return 'skipped';
    default:
      return 'pending';
  }
}

const TERMINAL_RUN_STATUSES: WorkflowRunStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
];

/** Workflow đã kết thúc nhưng stepRun còn RUNNING/PENDING trong DB → không còn chạy thật. */
export function effectiveStepRunStatus(
  sr: WorkflowStepRun,
  runStatus?: WorkflowRunStatus,
): WfRunStatus {
  const raw = stepRunToWfStatus(sr.status);
  if (
    runStatus &&
    TERMINAL_RUN_STATUSES.includes(runStatus) &&
    (sr.status === 'RUNNING' || sr.status === 'PENDING')
  ) {
    if (sr.exitCode != null) {
      return sr.exitCode === 0 ? 'completed' : 'failed';
    }
    if (sr.error) return 'failed';
    if (sr.output) return 'completed';
    return runStatus === 'FAILED' ? 'failed' : 'completed';
  }
  return raw;
}

function resolveStepFromRun(
  wf: Workflow | null | undefined,
  stepId: string,
): WorkflowStep | undefined {
  return (wf?.steps ?? []).find((s) => s.id === stepId);
}

export function stepRunToStepResult(
  sr: WorkflowStepRun,
  wf?: Workflow | null,
  runStatus?: WorkflowRunStatus,
): WorkflowStepResult {
  const step = resolveStepFromRun(wf, sr.stepId);
  const order = step?.order ?? sr.order;
  const wfStatus = effectiveStepRunStatus(sr, runStatus);
  return {
    step: order,
    stepId: sr.stepId,
    status:
      wfStatus === 'completed' ? 'completed' : wfStatus === 'failed' ? 'failed' : wfStatus,
    taskId: sr.taskId ?? undefined,
    exitCode: sr.exitCode,
    error: sr.error ?? undefined,
    path: sr.flowPath ?? undefined,
    depth: sr.depth,
    wave: sr.depth,
    output: parseStepRunOutput(sr.output),
  };
}

export function buildRunStatusFromStepRuns(
  wf: Workflow | null | undefined,
  stepRuns: WorkflowStepRun[],
): Record<string, WfRunStatus> {
  const keyByStepId = new Map(
    (wf?.steps ?? []).map((s) => [s.id ?? '', stepRuntimeKey(s)]),
  );
  const map: Record<string, WfRunStatus> = {};
  for (const sr of stepRuns) {
    const key = keyByStepId.get(sr.stepId) ?? sr.stepId;
    switch (sr.status) {
      case 'COMPLETED':
        map[key] = 'completed';
        break;
      case 'FAILED':
        map[key] = 'failed';
        break;
      case 'RUNNING':
        map[key] = 'running';
        break;
      case 'PENDING':
        map[key] = 'pending';
        break;
      case 'SKIPPED':
        map[key] = 'skipped';
        break;
      default:
        break;
    }
  }
  return map;
}

export function stepRunsToExecuteResult(
  wf: Workflow,
  runId: string,
  stepRuns: WorkflowStepRun[],
): {
  workflowId: string;
  name: string;
  runId: string;
  results: Array<{
    step: number;
    stepId?: string;
    status: string;
    taskId?: string;
    exitCode?: number | null;
    error?: string;
    path?: string;
    depth?: number;
    wave?: number;
  }>;
} {
  const orderByStepId = new Map(
    (wf.steps ?? []).map((s) => [s.id ?? '', s.order]),
  );
  const results = stepRuns
    .filter((sr) => sr.status === 'COMPLETED' || sr.status === 'FAILED')
    .map((sr) => ({
      step: orderByStepId.get(sr.stepId) ?? sr.order,
      stepId: sr.stepId,
      status: sr.status === 'COMPLETED' ? 'completed' : 'failed',
      taskId: sr.taskId ?? undefined,
      exitCode: sr.exitCode,
      error: sr.error ?? undefined,
      path: sr.flowPath ?? undefined,
      depth: sr.depth,
      wave: sr.depth,
      output: parseStepRunOutput(sr.output),
    }));
  return {
    workflowId: wf.id,
    name: wf.name,
    runId,
    results,
  };
}
