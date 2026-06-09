import type { WfRunStatus } from '@/src/lib/workflowGraph';
import type { Workflow, WorkflowStepRun } from '@/src/types/api';

export function stepKeyForStep(
  step: { id?: string; order: number; config?: unknown },
): string {
  const cfg = step.config as { stepKey?: string } | undefined;
  return cfg?.stepKey ?? step.id ?? `step-${step.order}`;
}

export function buildRunStatusFromStepRuns(
  wf: Workflow | null | undefined,
  stepRuns: WorkflowStepRun[],
): Record<string, WfRunStatus> {
  const keyByStepId = new Map(
    (wf?.steps ?? []).map((s) => [s.id ?? '', stepKeyForStep(s)]),
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
    }));
  return {
    workflowId: wf.id,
    name: wf.name,
    runId,
    results,
  };
}
