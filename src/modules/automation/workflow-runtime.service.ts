import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FlowRunStatus,
  StepRunStatus,
  WorkflowRunStatus,
  WorkflowTriggerType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramWorkflowProgressService } from '../triggers/telegram/telegram-workflow-progress.service';
import { AutomationService, type WorkflowStepResult } from './automation.service';
import { getStartStepIds, buildAdjacency } from './workflow-runtime/graph-utils';
import { resolveWorkflowGraphEdges } from './workflow-graph';

@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AutomationService))
    private readonly automation: AutomationService,
    private readonly telegramProgress: TelegramWorkflowProgressService,
  ) {}

  async getRun(runId: string, userId: string) {
    const run = await this.prisma.workflowRun.findFirst({
      where: { id: runId, userId },
      include: {
        flows: { orderBy: { path: 'asc' } },
        stepRuns: { orderBy: [{ flowPath: 'asc' }, { order: 'asc' }] },
        workflow: { select: { id: true, name: true } },
      },
    });
    if (!run) throw new NotFoundException('Workflow run not found');
    return run;
  }

  async startRunFromTrigger(
    workflowId: string,
    userId: string,
    opts: {
      triggerId: string;
      triggerType: WorkflowTriggerType;
      triggerPayload: Record<string, unknown>;
      variables: Record<string, unknown>;
    },
  ): Promise<{ runId: string; status: WorkflowRunStatus }> {
    const workflow = await this.automation.findOne(workflowId, userId);
    const wfRow = workflow as { graph?: unknown; graphEdges?: unknown };
    const graphEdges = resolveWorkflowGraphEdges(
      workflow.steps,
      wfRow.graph,
      wfRow.graphEdges,
    );

    if (!graphEdges.length) {
      throw new BadRequestException(
        'Workflow has no valid graph connections. Save the canvas edges before running.',
      );
    }

    const adj = buildAdjacency(graphEdges);
    const starts = getStartStepIds(workflow.steps, adj);

    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId,
        userId,
        status: WorkflowRunStatus.RUNNING,
        variables: opts.variables as object,
        triggerId: opts.triggerId,
        triggerType: opts.triggerType,
        triggerPayload: opts.triggerPayload as object,
        flows: {
          create: starts.map((_, i) => ({
            path: `branch-${i}`,
            status: FlowRunStatus.RUNNING,
          })),
        },
      },
    });

    void this.executeRunBody(workflowId, workflow, userId, graphEdges, run.id);

    return { runId: run.id, status: WorkflowRunStatus.RUNNING };
  }

  private async executeRunBody(
    workflowId: string,
    workflow: Awaited<ReturnType<AutomationService['findOne']>>,
    userId: string,
    graphEdges: ReturnType<typeof resolveWorkflowGraphEdges>,
    runId: string,
  ) {
    try {
      await this.automation.executeGraphInternal(
        workflowId,
        workflow,
        userId,
        graphEdges,
        { workflowRunId: runId },
      );

      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: WorkflowRunStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await this.prisma.workflowFlowRun.updateMany({
        where: { workflowRunId: runId, status: FlowRunStatus.RUNNING },
        data: { status: FlowRunStatus.COMPLETED, completedAt: new Date() },
      });

      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: { updatedAt: new Date() },
      });

      await this.telegramProgress.finalize(runId, WorkflowRunStatus.COMPLETED);
    } catch (err) {
      this.logger.error(`Workflow run ${runId} failed`, err);
      const msg = err instanceof Error ? err.message : 'Workflow failed';
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: {
          status: WorkflowRunStatus.FAILED,
          completedAt: new Date(),
        },
      });
      await this.telegramProgress.finalize(runId, WorkflowRunStatus.FAILED, msg);
    }
  }

  async startRun(
    workflowId: string,
    userId: string,
    wait: boolean,
  ): Promise<
    | { runId: string; status: WorkflowRunStatus; workflowId: string; name: string }
    | {
        runId: string;
        workflowId: string;
        name: string;
        results: WorkflowStepResult[];
      }
  > {
    const workflow = await this.automation.findOne(workflowId, userId);
    const wfRow = workflow as { graph?: unknown; graphEdges?: unknown };
    const graphEdges = resolveWorkflowGraphEdges(
      workflow.steps,
      wfRow.graph,
      wfRow.graphEdges,
    );

    if (!graphEdges.length) {
      throw new BadRequestException(
        'Workflow has no valid graph connections. Save the canvas edges before running.',
      );
    }

    const adj = buildAdjacency(graphEdges);
    const starts = getStartStepIds(workflow.steps, adj);

    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId,
        userId,
        status: WorkflowRunStatus.RUNNING,
        variables: (workflow as { variables?: unknown }).variables as object | undefined,
        flows: {
          create: starts.map((_, i) => ({
            path: `branch-${i}`,
            status: FlowRunStatus.RUNNING,
          })),
        },
      },
    });

    if (wait) {
      try {
        const results = await this.automation.executeGraphInternal(
          workflowId,
          workflow,
          userId,
          graphEdges,
          { workflowRunId: run.id },
        );
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: WorkflowRunStatus.COMPLETED, completedAt: new Date() },
        });
        await this.prisma.workflowFlowRun.updateMany({
          where: { workflowRunId: run.id, status: FlowRunStatus.RUNNING },
          data: { status: FlowRunStatus.COMPLETED, completedAt: new Date() },
        });
        await this.telegramProgress.finalize(run.id, WorkflowRunStatus.COMPLETED);
        return {
          runId: run.id,
          workflowId,
          name: workflow.name,
          results,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Workflow failed';
        await this.prisma.workflowRun.update({
          where: { id: run.id },
          data: { status: WorkflowRunStatus.FAILED, completedAt: new Date() },
        });
        await this.telegramProgress.finalize(run.id, WorkflowRunStatus.FAILED, msg);
        throw err;
      }
    }

    void this.executeRunBody(workflowId, workflow, userId, graphEdges, run.id);

    return {
      runId: run.id,
      status: WorkflowRunStatus.RUNNING,
      workflowId,
      name: workflow.name,
    };
  }

  async upsertStepRun(
    workflowRunId: string,
    step: { id: string; order: number },
    meta: { flowPath: string; depth: number },
    patch: {
      status?: StepRunStatus;
      taskId?: string;
      exitCode?: number | null;
      error?: string;
      startedAt?: Date;
      completedAt?: Date;
    },
  ) {
    const existing = await this.prisma.workflowStepRun.findFirst({
      where: {
        workflowRunId,
        stepId: step.id,
        flowPath: meta.flowPath,
        depth: meta.depth,
      },
    });

    if (existing) {
      return this.prisma.workflowStepRun.update({
        where: { id: existing.id },
        data: patch,
      });
    }

    return this.prisma.workflowStepRun.create({
      data: {
        workflowRunId,
        stepId: step.id,
        order: step.order,
        flowPath: meta.flowPath,
        depth: meta.depth,
        status: patch.status ?? StepRunStatus.PENDING,
        taskId: patch.taskId,
        exitCode: patch.exitCode,
        error: patch.error,
        startedAt: patch.startedAt,
        completedAt: patch.completedAt,
      },
    });
  }

  async markFlowStopped(workflowRunId: string, flowPath: string) {
    await this.prisma.workflowFlowRun.updateMany({
      where: { workflowRunId, path: flowPath },
      data: {
        status: FlowRunStatus.STOPPED,
        completedAt: new Date(),
      },
    });
  }
}
