import { Logger } from '@nestjs/common';
import { OnFailure, StepType } from '@prisma/client';
import type { WorkflowGraphEdge } from './graph-utils';

export interface WorkflowStepResult {
  step: number;
  stepId?: string;
  status: string;
  taskId?: string;
  exitCode?: number | null;
  error?: string;
  branch?: string;
  path?: string;
  /** Độ sâu trên nhánh (0 = từ trigger). */
  depth?: number;
  /** @deprecated Dùng depth — giữ tương thích response cũ */
  wave?: number;
}
import {
  buildAdjacency,
  buildStepIndegree,
  filterOutEdges,
  getStartStepIds,
} from './graph-utils';
import { emptyCtx, mergeStepContexts, type StepContext } from './run-context';

const logger = new Logger('GraphScheduler');

export type ReadyItem = {
  stepId: string;
  ctx: StepContext;
  path: string;
  depth: number;
};

export type WorkflowStepLike = {
  id: string;
  order: number;
  type: StepType;
  config: unknown;
  onFailure: OnFailure;
};

export type StepRunOutcome = {
  result: WorkflowStepResult | null;
  nextCtx: StepContext;
  stop: boolean;
  branch?: string;
};

export type RunStepFn = (
  step: WorkflowStepLike,
  ctx: StepContext,
  meta: { path: string; depth: number },
) => Promise<StepRunOutcome>;

/**
 * Event-driven DAG: mỗi step schedule con ngay khi xong, không chờ sibling cùng "sóng".
 */
export async function executeGraphIndependent(
  workflowId: string,
  steps: WorkflowStepLike[],
  graphEdges: WorkflowGraphEdge[],
  workflowVars: Record<string, unknown>,
  runStep: RunStepFn,
): Promise<WorkflowStepResult[]> {
  const results: WorkflowStepResult[] = [];
  const stepsById = new Map(steps.map((s) => [s.id, s]));
  const stepIds = new Set(steps.map((s) => s.id));
  const adj = buildAdjacency(graphEdges);
  const pendingParents = buildStepIndegree(stepIds, graphEdges);
  const parentCtxs = new Map<string, StepContext[]>();
  for (const sid of stepIds) parentCtxs.set(sid, []);

  let inFlight = 0;
  let settle: (() => void) | null = null;
  const donePromise = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const maybeDone = () => {
    if (inFlight === 0) settle?.();
  };

  const scheduleChildren = (
    wr: StepRunOutcome & { item: ReadyItem; step?: WorkflowStepLike },
  ) => {
    if (wr.stop) {
      logger.warn(
        `Workflow ${workflowId}: branch ${wr.item.path} stopped at step ${wr.step?.order ?? wr.item.stepId}`,
      );
      return;
    }
    if (!wr.step) return;

    const outs = filterOutEdges(
      wr.step,
      adj.get(wr.item.stepId) ?? [],
      wr.branch,
    );

    for (const out of outs) {
      if (!stepIds.has(out.targetId)) continue;

      parentCtxs.get(out.targetId)!.push(wr.nextCtx);

      const left = (pendingParents.get(out.targetId) ?? 0) - 1;
      pendingParents.set(out.targetId, left);

      if (left <= 0) {
        inFlight += 1;
        void runOne({
          stepId: out.targetId,
          ctx: mergeStepContexts(parentCtxs.get(out.targetId)!),
          path: wr.item.path,
          depth: wr.item.depth + 1,
        });
        parentCtxs.set(out.targetId, []);
      }
    }
  };

  const runOne = async (item: ReadyItem) => {
    const step = stepsById.get(item.stepId);

    try {
      if (!step) {
        scheduleChildren({
          item,
          stop: false,
          result: null,
          nextCtx: item.ctx,
        });
        return;
      }

      let outcome: StepRunOutcome;
      try {
        outcome = await runStep(step, item.ctx, {
          path: item.path,
          depth: item.depth,
        });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        outcome = {
          result: {
            step: step.order,
            stepId: step.id,
            status: 'failed',
            error: errMsg,
            path: item.path,
            depth: item.depth,
          },
          nextCtx: {
            exitCode: -1,
            failed: true,
            scope: item.ctx.scope,
          },
          stop: step.onFailure === OnFailure.STOP,
          branch: undefined,
        };
      }

      if (outcome.result) {
        results.push({
          ...outcome.result,
          path: item.path,
          depth: item.depth,
        });
      }

      scheduleChildren({ ...outcome, item, step });
    } finally {
      inFlight -= 1;
      maybeDone();
    }
  };

  const starts = getStartStepIds(steps, adj);
  if (!starts.length) {
    return results;
  }

  for (let i = 0; i < starts.length; i++) {
    inFlight += 1;
    void runOne({
      stepId: starts[i]!,
      ctx: emptyCtx(workflowVars),
      path: `branch-${i}`,
      depth: 0,
    });
  }

  await donePromise;
  return results;
}
