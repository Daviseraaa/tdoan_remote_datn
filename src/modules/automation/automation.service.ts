import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StepRunStatus } from '@prisma/client';
import { registerTaskCompletionWaiter } from '../../common/task-completion-registry';
import { OnFailure, StepType, TaskStatus, TaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/index';
import { TasksService } from '../tasks/tasks.service';
import {
  buildRunScope,
  buildStepOutput,
  parseWorkflowVariables,
  publishStepOutput,
  resolvePayload,
  resolveTemplateString,
} from './workflow-variables';
import {
  resolveWorkflowGraphEdges,
  sanitizeStepConfig,
} from './workflow-graph';
import {
  executeGraphIndependent,
  type StepContext,
} from './workflow-runtime';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { TelegramActionService } from '../triggers/telegram/telegram-action.service';
import type { TelegramStepConfig } from '../triggers/telegram/telegram.types';

const TERMINAL_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.TIMEOUT,
  TaskStatus.CANCELLED,
];

const POLL_INTERVAL_MS = 300;
const DEFAULT_TASK_TIMEOUT_MS = 300_000;
const MAX_POLL_MS = 600_000;
export const WF_TRIGGER_ID = '__trigger__';
const HANDLE_TRUE = 'true';
const HANDLE_FALSE = 'false';

export interface WorkflowGraphEdge {
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface WorkflowGraphEdgeStored {
  sourceOrder: number;
  targetOrder: number;
  sourceHandle?: string;
}

export interface WorkflowStepConfig {
  agentId?: string;
  taskType?: TaskType;
  command?: string;
  payload?: Record<string, unknown>;
  timeout?: number;
  delayMs?: number;
  title?: string;
  ui?: { x: number; y: number };
  graphEdges?: WorkflowGraphEdgeStored[] | WorkflowGraphEdge[];
  conditionMode?: 'last_exit_success' | 'last_exit_failed' | 'last_exit_code_eq';
  conditionExitCode?: number;
  outputKey?: string;
}

export interface WorkflowStepResult {
  step: number;
  stepId?: string;
  status: string;
  taskId?: string;
  exitCode?: number | null;
  error?: string;
  branch?: string;
  /** Nhánh song song (vd. branch-0) — gán tại fork từ trigger / parent. */
  path?: string;
  /** Độ sâu trên nhánh (0 = từ trigger). */
  depth?: number;
  /** @deprecated Dùng depth */
  wave?: number;
  /** Kết quả bước không-task (vd. Telegram API). */
  actionResult?: string;
}

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

function getGraphEdges(
  steps: { id: string; order: number; config: unknown }[],
  workflow?: { graph?: unknown; graphEdges?: unknown },
): WorkflowGraphEdge[] {
  return resolveWorkflowGraphEdges(
    steps,
    workflow?.graph,
    workflow?.graphEdges,
  );
}

function evaluateCondition(
  config: WorkflowStepConfig,
  ctx: StepContext,
): boolean {
  const mode = config.conditionMode ?? 'last_exit_success';
  if (mode === 'last_exit_failed') return ctx.failed;
  if (mode === 'last_exit_code_eq') {
    return (ctx.exitCode ?? -1) === (config.conditionExitCode ?? 0);
  }
  return !ctx.failed && (ctx.exitCode === 0 || ctx.exitCode === null);
}

function resolveTaskType(stepType: StepType, config: WorkflowStepConfig): TaskType {
  if (config.taskType && Object.values(TaskType).includes(config.taskType)) {
    return config.taskType;
  }
  if (stepType === StepType.SCRIPT) return TaskType.SCRIPT;
  return TaskType.COMMAND;
}

function resolveCommand(taskType: TaskType, config: WorkflowStepConfig): string {
  const cmd = (config.command ?? '').trim();
  if (taskType === TaskType.SYSTEM_INFO) return cmd || 'collect';
  if (taskType === TaskType.DESKTOP_AUTOMATION) return cmd || '[]';
  return cmd;
}

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
    @Inject(forwardRef(() => WorkflowRuntimeService))
    private workflowRuntime: WorkflowRuntimeService,
    private telegramActions: TelegramActionService,
  ) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        cronExpression: dto.cronExpression,
        isActive: dto.isActive ?? true,
        ...(dto.variables != null ? { variables: dto.variables as object } : {}),
        ...(dto.graph != null ? { graph: dto.graph as object } : {}),
        userId,
        steps: {
          create: dto.steps.map((step) => ({
            order: step.order,
            type: step.type,
            config: sanitizeStepConfig(
              step.config as Record<string, unknown>,
            ) as object,
            onFailure: step.onFailure ?? OnFailure.STOP,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const where = { userId };
    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        include: { steps: { orderBy: { order: 'asc' } } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({ where }),
    ]);
    return new PaginatedResponseDto(workflows, total, pagination);
  }

  async findOne(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async update(id: string, userId: string, dto: UpdateWorkflowDto) {
    await this.findOne(id, userId);

    const { steps, ...workflowData } = dto;

    if (steps) {
      await this.prisma.workflowStep.deleteMany({ where: { workflowId: id } });
    }

    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...(workflowData as Record<string, unknown>),
        ...(steps && {
          steps: {
            create: steps.map((step) => ({
              order: step.order,
              type: step.type,
              config: sanitizeStepConfig(
                step.config as Record<string, unknown>,
              ) as object,
              onFailure: step.onFailure ?? OnFailure.STOP,
            })),
          },
        }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.workflow.delete({ where: { id } });
    return { message: 'Workflow deleted successfully' };
  }

  private async waitForTask(
    taskId: string,
    userId: string,
    timeoutMs: number,
  ): Promise<{
    status: TaskStatus;
    exitCode: number | null;
    result?: string;
    error?: string;
  }> {
    const eventWait = registerTaskCompletionWaiter(taskId, timeoutMs);

    const pollWait = (async () => {
      const deadline = Date.now() + Math.min(timeoutMs + 30_000, MAX_POLL_MS);
      while (Date.now() < deadline) {
        const task = await this.prisma.task.findFirst({
          where: { id: taskId, userId },
          select: { status: true, exitCode: true, result: true },
        });
        if (!task) {
          return {
            status: TaskStatus.FAILED,
            exitCode: -1,
            error: 'Task not found',
          };
        }
        if (TERMINAL_STATUSES.includes(task.status)) {
          return {
            status: task.status,
            exitCode: task.exitCode,
            result: task.result ?? undefined,
            error:
              task.status === TaskStatus.FAILED ||
              task.status === TaskStatus.TIMEOUT ||
              task.status === TaskStatus.CANCELLED
                ? task.result ?? undefined
                : undefined,
          };
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      return {
        status: TaskStatus.TIMEOUT,
        exitCode: null,
        error: 'Workflow step timed out waiting for task',
      };
    })();

    return Promise.race([eventWait, pollWait]);
  }

  private async runStep(
    userId: string,
    step: {
      id: string;
      order: number;
      type: StepType;
      config: unknown;
      onFailure: OnFailure;
    },
    ctx: StepContext,
    meta?: { workflowRunId?: string; flowPath?: string; depth?: number },
  ): Promise<{ result: WorkflowStepResult; ctx: StepContext; stop: boolean }> {
    const config = parseConfig(step.config);
    const runId = meta?.workflowRunId;
    const flowPath = meta?.flowPath ?? 'branch-0';
    const depth = meta?.depth ?? 0;

    const trackStart = async () => {
      if (!runId) return;
      await this.workflowRuntime.upsertStepRun(runId, step, { flowPath, depth }, {
        status: StepRunStatus.RUNNING,
        startedAt: new Date(),
      });
    };

    const trackEnd = async (
      status: StepRunStatus,
      extra?: {
        taskId?: string;
        exitCode?: number | null;
        error?: string;
      },
    ) => {
      if (!runId) return;
      await this.workflowRuntime.upsertStepRun(runId, step, { flowPath, depth }, {
        status,
        completedAt: new Date(),
        taskId: extra?.taskId,
        exitCode: extra?.exitCode,
        error: extra?.error,
      });
      if (status === StepRunStatus.FAILED && extra?.error) {
        await this.workflowRuntime.markFlowStopped(runId, flowPath);
      }
    };

    if (step.type === StepType.DELAY) {
      await trackStart();
      const delayMs = Math.max(0, config.delayMs ?? 1000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await trackEnd(StepRunStatus.COMPLETED);
      return {
        result: { step: step.order, stepId: step.id, status: 'completed' },
        ctx,
        stop: false,
      };
    }

    if (step.type === StepType.CONDITION) {
      await trackStart();
      const pass = evaluateCondition(config, ctx);
      await trackEnd(StepRunStatus.COMPLETED);
      return {
        result: {
          step: step.order,
          stepId: step.id,
          status: 'completed',
          branch: pass ? HANDLE_TRUE : HANDLE_FALSE,
        },
        ctx,
        stop: false,
      };
    }

    if (step.type === StepType.TELEGRAM) {
      await trackStart();
      const tg = config as TelegramStepConfig & {
        telegramBotId?: string;
        botToken?: string;
      };
      let botToken = tg.botToken;
      if (!botToken && tg.telegramBotId) {
        const bot = await this.prisma.telegramBot.findFirst({
          where: { id: tg.telegramBotId, userId },
        });
        botToken = bot?.botToken;
      }
      if (!botToken) {
        throw new Error('Telegram step requires botToken or telegramBotId');
      }
      try {
        const { result: tgResult, messageId } = await this.telegramActions.runAction(
          botToken,
          tg,
          ctx.scope,
        );
        await trackEnd(StepRunStatus.COMPLETED);
        return {
          result: {
            step: step.order,
            stepId: step.id,
            status: 'completed',
            actionResult: tgResult,
            taskId: messageId != null ? `tg:${messageId}` : undefined,
          },
          ctx,
          stop: false,
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Telegram action failed';
        await trackEnd(StepRunStatus.FAILED, { error: errMsg });
        return {
          result: {
            step: step.order,
            stepId: step.id,
            status: 'failed',
            error: errMsg,
          },
          ctx,
          stop: step.onFailure === OnFailure.STOP,
        };
      }
    }

    const taskType = resolveTaskType(step.type, config);
    const rawCommand = resolveCommand(taskType, config);
    const scope = ctx.scope;
    const command = resolveTemplateString(rawCommand, scope);
    const payload = resolvePayload(config.payload, scope);

    if (!config.agentId) {
      throw new Error('Step config missing agentId');
    }
    if (taskType !== TaskType.SYSTEM_INFO && !command) {
      throw new Error('Step config missing command');
    }

    const timeoutMs = config.timeout ?? DEFAULT_TASK_TIMEOUT_MS;
    await trackStart();
    const task = await this.tasksService.create(
      userId,
      {
        type: taskType,
        command,
        agentId: config.agentId,
        payload,
        timeout: timeoutMs,
      },
      runId ? { workflowRunId: runId } : undefined,
    );

    if (runId) {
      await this.workflowRuntime.upsertStepRun(runId, step, { flowPath, depth }, {
        status: StepRunStatus.RUNNING,
        taskId: task.id,
        startedAt: new Date(),
      });
    }

    const outcome = await this.waitForTask(task.id, userId, timeoutMs);
    const failed =
      outcome.status === TaskStatus.FAILED ||
      outcome.status === TaskStatus.TIMEOUT ||
      outcome.status === TaskStatus.CANCELLED;

    const { key, output } = buildStepOutput(step, config, {
      exitCode: outcome.exitCode,
      failed,
      result: outcome.result,
    });
    const nextScope = publishStepOutput(scope, key, output);

    const newCtx: StepContext = {
      exitCode: outcome.exitCode,
      failed,
      scope: nextScope,
    };

    await trackEnd(
      failed ? StepRunStatus.FAILED : StepRunStatus.COMPLETED,
      {
        taskId: task.id,
        exitCode: outcome.exitCode,
        error: failed ? outcome.error ?? `Task ${outcome.status}` : undefined,
      },
    );

    return {
      result: {
        step: step.order,
        stepId: step.id,
        status: failed ? 'failed' : 'completed',
        taskId: task.id,
        exitCode: outcome.exitCode,
        error: failed ? outcome.error ?? `Task ${outcome.status}` : undefined,
      },
      ctx: newCtx,
      stop: failed && step.onFailure === OnFailure.STOP,
    };
  }

  async executeGraphInternal(
    id: string,
    workflow: Awaited<ReturnType<AutomationService['findOne']>>,
    userId: string,
    graphEdges: WorkflowGraphEdge[],
    runOpts?: { workflowRunId?: string; flowPath?: string },
  ): Promise<WorkflowStepResult[]> {
    let runVars: Record<string, unknown> = {
      ...parseWorkflowVariables((workflow as { variables?: unknown }).variables),
    };
    if (runOpts?.workflowRunId) {
      const run = await this.prisma.workflowRun.findUnique({
        where: { id: runOpts.workflowRunId },
        select: { variables: true },
      });
      if (run?.variables && typeof run.variables === 'object') {
        runVars = run.variables as Record<string, unknown>;
      }
    }

    const raw = await executeGraphIndependent(
      id,
      workflow.steps,
      graphEdges,
      runVars,
      async (step, ctx, meta) => {
        const { result, ctx: nextCtx, stop } = await this.runStep(
          userId,
          step,
          ctx,
          {
            workflowRunId: runOpts?.workflowRunId,
            flowPath: meta.path,
            depth: meta.depth,
          },
        );
        return {
          result,
          nextCtx,
          stop,
          branch: result.branch,
        };
      },
    );

    return raw.map((r) => ({
      ...r,
      wave: r.depth ?? r.wave,
    }));
  }

  async execute(id: string, userId: string, wait = false) {
    const outcome = await this.workflowRuntime.startRun(id, userId, wait);
    if (wait && 'results' in outcome) {
      return {
        workflowId: id,
        name: outcome.name,
        runId: outcome.runId,
        results: outcome.results,
      };
    }
    return outcome;
  }
}
