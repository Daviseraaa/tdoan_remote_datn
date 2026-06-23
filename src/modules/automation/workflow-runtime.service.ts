import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import type { QueryUserWorkflowRunsDto } from './dto/query-user-workflow-runs.dto';
import {
  FlowRunStatus,
  StepRunStatus,
  TaskStatus,
  WorkflowRunStatus,
  WorkflowTriggerType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionService } from '../billing/subscription.service';
import { TasksService } from '../tasks/tasks.service';
import { TelegramWorkflowProgressService } from '../triggers/telegram/telegram-workflow-progress.service';
import { AutomationService, type WorkflowStepResult } from './automation.service';
import { getStartStepIds, buildAdjacency } from './workflow-runtime/graph-utils';
import { resolveWorkflowGraphEdges } from './workflow-graph';
import { stripInternalWorkflowVars } from './workflow-variables';

@Injectable()
export class WorkflowRuntimeService {
  private readonly logger = new Logger(WorkflowRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscription: SubscriptionService,
    private readonly tasksService: TasksService,
    @Inject(forwardRef(() => AutomationService))
    private readonly automation: AutomationService,
    private readonly telegramProgress: TelegramWorkflowProgressService,
  ) {}

  async listRuns(userId: string, query: QueryUserWorkflowRunsDto) {
    const where: Prisma.WorkflowRunWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.workflowId && { workflowId: query.workflowId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          workflow: { select: { id: true, name: true, isActive: true } },
          _count: { select: { stepRuns: true } },
        },
      }),
      this.prisma.workflowRun.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, query);
  }

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

  /** Ghi snapshot biến workflow (sau đọc Excel, gán biến, …) vào lần chạy. */
  async persistRunVariables(
    workflowRunId: string,
    workflow: Record<string, unknown>,
  ) {
    const snap = stripInternalWorkflowVars(workflow);
    if (!Object.keys(snap).length) return;

    const run = await this.prisma.workflowRun.findUnique({
      where: { id: workflowRunId },
      select: { variables: true },
    });
    const prev =
      run?.variables &&
      typeof run.variables === 'object' &&
      !Array.isArray(run.variables)
        ? { ...(run.variables as Record<string, unknown>) }
        : {};

    await this.prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { variables: { ...prev, ...snap } as object },
    });
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
    await this.subscription.assertActive(userId);

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

      await this.finalizeStaleStepRuns(runId, WorkflowRunStatus.COMPLETED);

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
      await this.finalizeStaleStepRuns(runId, WorkflowRunStatus.FAILED);

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

  /** Đóng các step run còn RUNNING/PENDING khi workflow đã kết thúc (tránh bản ghi stale). */
  async finalizeStaleStepRuns(
    workflowRunId: string,
    runStatus: WorkflowRunStatus,
  ) {
    const stale = await this.prisma.workflowStepRun.findMany({
      where: {
        workflowRunId,
        status: { in: [StepRunStatus.RUNNING, StepRunStatus.PENDING] },
      },
    });
    if (!stale.length) return;

    const now = new Date();
    for (const sr of stale) {
      let status: StepRunStatus =
        runStatus === WorkflowRunStatus.FAILED
          ? StepRunStatus.FAILED
          : StepRunStatus.COMPLETED;
      let exitCode = sr.exitCode;
      let error = sr.error;

      if (sr.taskId) {
        const task = await this.prisma.task.findUnique({
          where: { id: sr.taskId },
          select: { status: true, exitCode: true, result: true },
        });
        if (task) {
          if (task.status === TaskStatus.COMPLETED) {
            status = StepRunStatus.COMPLETED;
            exitCode = task.exitCode;
          } else if (
            task.status === TaskStatus.FAILED ||
            task.status === TaskStatus.TIMEOUT ||
            task.status === TaskStatus.CANCELLED
          ) {
            status = StepRunStatus.FAILED;
            exitCode = task.exitCode;
            error = task.result ?? `Task ${task.status}`;
          } else if (
            runStatus === WorkflowRunStatus.FAILED &&
            (task.status === TaskStatus.RUNNING ||
              task.status === TaskStatus.QUEUED ||
              task.status === TaskStatus.PENDING)
          ) {
            const msg = 'Workflow kết thúc trước khi task hoàn thành';
            await this.tasksService.markTaskTimedOutIfActive(sr.taskId, msg);
            status = StepRunStatus.FAILED;
            error = msg;
          }
        }
      }

      await this.prisma.workflowStepRun.update({
        where: { id: sr.id },
        data: {
          status,
          exitCode,
          error,
          completedAt: now,
        },
      });
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
    await this.subscription.assertActive(userId);

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
        await this.finalizeStaleStepRuns(run.id, WorkflowRunStatus.COMPLETED);
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
        await this.finalizeStaleStepRuns(run.id, WorkflowRunStatus.FAILED);
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
      output?: object;
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
        output: patch.output,
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
