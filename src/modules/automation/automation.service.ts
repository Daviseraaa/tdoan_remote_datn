import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { StepRunStatus, WorkflowTriggerType } from '@prisma/client';
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
import { TelegramWorkflowProgressService } from '../triggers/telegram/telegram-workflow-progress.service';
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
  /** Chờ sau bước (ms); ghi đè workflow.stepDelayMs nếu set */
  delayAfterMs?: number;
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

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayAfterStepMs(
  step: { type: StepType; config: unknown },
  workflowStepDelayMs: number,
): number {
  const cfg = parseConfig(step.config);
  if (cfg.delayAfterMs != null && Number.isFinite(cfg.delayAfterMs)) {
    return Math.max(0, Math.floor(cfg.delayAfterMs));
  }
  return Math.max(0, Math.floor(workflowStepDelayMs));
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

/** Literal — cần `npx prisma generate` sau enum; `TaskType.CHROME_EXTENSION` undefined nếu client cũ. */
const CHROME_EXTENSION_TYPE = 'CHROME_EXTENSION' as TaskType;

const CHROME_EXTENSION_ACTIONS = new Set([
  'snapshotDom',
  'click',
  'fill',
  'waitFor',
  'delay',
]);

const CHROME_EXTENSION_PAYLOAD_KEYS = [
  'selector',
  'text',
  'tabId',
  'urlPattern',
  'maxNodes',
  'timeoutMs',
] as const;

function normalizeChromeExtensionPayload(
  config: WorkflowStepConfig,
  payload: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const p = { ...(payload ?? {}) };
  const cmdTrim = (config.command ?? '').trim();
  if (typeof p.action !== 'string' && CHROME_EXTENSION_ACTIONS.has(cmdTrim)) {
    p.action = cmdTrim;
  }
  if (typeof p.action !== 'string') {
    p.action = 'snapshotDom';
  }
  if (p.maxNodes == null) p.maxNodes = 200;
  return p;
}

function chromeExtensionCommandFromPayload(
  payload: Record<string, unknown>,
): string {
  if (Array.isArray(payload.steps) && payload.steps.length > 0) {
    return JSON.stringify(payload.steps);
  }
  const step: Record<string, unknown> = { action: payload.action };
  for (const key of CHROME_EXTENSION_PAYLOAD_KEYS) {
    const v = payload[key];
    if (v !== undefined && v !== null && v !== '') {
      step[key] = v;
    }
  }
  return JSON.stringify([step]);
}

function isChromeExtensionPlaceholderCommand(cmd: string): boolean {
  const t = cmd.trim();
  return t === '' || t === '[]';
}

function commandJsonHasChromeActions(command: string): boolean {
  const t = command.trim();
  if (!t.startsWith('[') && !t.startsWith('{')) return false;
  try {
    const v = JSON.parse(t) as unknown;
    const steps = Array.isArray(v)
      ? v
      : v &&
          typeof v === 'object' &&
          Array.isArray((v as { steps?: unknown[] }).steps)
        ? (v as { steps: unknown[] }).steps
        : [];
    return steps.some(
      (s) =>
        s &&
        typeof s === 'object' &&
        CHROME_EXTENSION_ACTIONS.has(
          String((s as { action?: string }).action ?? ''),
        ),
    );
  } catch {
    return false;
  }
}

function configTaskTypeUpper(config: WorkflowStepConfig): string {
  return config.taskType != null ? String(config.taskType).toUpperCase() : '';
}

function resolveTaskType(stepType: StepType, config: WorkflowStepConfig): TaskType {
  const ttUpper = configTaskTypeUpper(config);
  switch (ttUpper) {
    case 'CHROME_EXTENSION':
      return CHROME_EXTENSION_TYPE;
    case 'OPEN_BROWSER':
      return TaskType.OPEN_BROWSER;
    case 'DESKTOP_AUTOMATION':
      return TaskType.DESKTOP_AUTOMATION;
    case 'OPEN_APP':
      return TaskType.OPEN_APP;
    case 'SYSTEM_INFO':
      return TaskType.SYSTEM_INFO;
    case 'SCREEN_CAPTURE':
      return TaskType.SCREEN_CAPTURE;
    case 'SCRIPT':
      return TaskType.SCRIPT;
    case 'FILE_OPERATION':
      return TaskType.FILE_OPERATION;
    case 'COMMAND':
      return TaskType.COMMAND;
    default:
      break;
  }

  const tt = config.taskType;
  if (tt && Object.values(TaskType).includes(tt as TaskType)) {
    return tt as TaskType;
  }

  const cmd = (config.command ?? '').trim();
  if (CHROME_EXTENSION_ACTIONS.has(cmd)) {
    return CHROME_EXTENSION_TYPE;
  }
  if (isChromeExtensionPlaceholderCommand(cmd)) {
    const p = config.payload;
    if (p && typeof p === 'object' && !Array.isArray(p)) {
      const pl = p as Record<string, unknown>;
      if (
        typeof pl.action === 'string' &&
        CHROME_EXTENSION_ACTIONS.has(pl.action)
      ) {
        return CHROME_EXTENSION_TYPE;
      }
      if (Array.isArray(pl.steps) && pl.steps.length > 0) {
        return TaskType.DESKTOP_AUTOMATION;
      }
    }
  }
  if (cmd.startsWith('[') || cmd.startsWith('{')) {
    try {
      const v = JSON.parse(cmd) as unknown;
      const steps = Array.isArray(v)
        ? v
        : v &&
            typeof v === 'object' &&
            Array.isArray((v as { steps?: unknown[] }).steps)
          ? (v as { steps: unknown[] }).steps
          : null;
      if (
        steps?.length &&
        steps.some(
          (s) =>
            s &&
            typeof s === 'object' &&
            CHROME_EXTENSION_ACTIONS.has(
              String((s as { action?: string }).action ?? ''),
            ),
        )
      ) {
        return CHROME_EXTENSION_TYPE;
      }
    } catch {
      /* not json */
    }
  }

  const payload = config.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof payload.action === 'string' &&
    CHROME_EXTENSION_ACTIONS.has(payload.action)
  ) {
    return CHROME_EXTENSION_TYPE;
  }

  if (stepType === StepType.SCRIPT) return TaskType.SCRIPT;
  return TaskType.COMMAND;
}

function resolveCommand(taskType: TaskType, config: WorkflowStepConfig): string {
  const cmd = (config.command ?? '').trim();
  if (taskType === TaskType.SYSTEM_INFO) return cmd || 'collect';
  if (taskType === TaskType.SCREEN_CAPTURE) return cmd || '0';
  if (taskType === TaskType.OPEN_BROWSER) return cmd || 'https://example.com';
  if (taskType === TaskType.DESKTOP_AUTOMATION) return cmd || '[]';
  if (taskType === CHROME_EXTENSION_TYPE) return cmd || '[]';
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
    private telegramProgress: TelegramWorkflowProgressService,
  ) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        cronExpression: dto.cronExpression,
        isActive: dto.isActive ?? true,
        stepDelayMs: Math.max(0, dto.stepDelayMs ?? 0),
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
      this.telegramProgress.onStepStart(runId, step.id);
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
      this.telegramProgress.onStepEnd(runId, step.id, status);
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

    let taskType = resolveTaskType(step.type, config);
    const scope = ctx.scope;
    let payload = resolvePayload(config.payload, scope) as
      | Record<string, unknown>
      | undefined;
    const rawCommand = resolveCommand(taskType, config);
    let command = resolveTemplateString(rawCommand, scope);

    const configSaysChrome = configTaskTypeUpper(config) === 'CHROME_EXTENSION';
    const payloadSaysChrome =
      payload &&
      typeof payload.action === 'string' &&
      CHROME_EXTENSION_ACTIONS.has(payload.action);
    const commandSaysChrome = commandJsonHasChromeActions(command);

    if (
      configSaysChrome ||
      payloadSaysChrome ||
      commandSaysChrome ||
      taskType === CHROME_EXTENSION_TYPE
    ) {
      taskType = CHROME_EXTENSION_TYPE;
      const cmdTrim = (config.command ?? '').trim();
      const resolvedCmd = command.trim();
      const useJsonCommand =
        !isChromeExtensionPlaceholderCommand(cmdTrim) &&
        !isChromeExtensionPlaceholderCommand(resolvedCmd) &&
        (cmdTrim.startsWith('[') ||
          cmdTrim.startsWith('{') ||
          resolvedCmd.startsWith('[') ||
          resolvedCmd.startsWith('{'));

      if (useJsonCommand && commandJsonHasChromeActions(resolvedCmd)) {
        command = resolvedCmd;
      } else if (
        useJsonCommand &&
        commandJsonHasChromeActions(resolveTemplateString(cmdTrim, scope))
      ) {
        command = resolveTemplateString(cmdTrim, scope);
      } else {
        payload = normalizeChromeExtensionPayload(
          config,
          payload as Record<string, unknown> | undefined,
        );
        command = chromeExtensionCommandFromPayload(payload);
      }
    }

    if (
      taskType === TaskType.COMMAND &&
      isChromeExtensionPlaceholderCommand(command)
    ) {
      throw new Error(
        'Node Chrome extension: lưu workflow (Save) rồi chạy lại — thiếu taskType/payload hoặc server chưa restart.',
      );
    }

    if (!config.agentId) {
      throw new Error('Step config missing agentId');
    }
    if (
      taskType !== TaskType.SYSTEM_INFO &&
      taskType !== TaskType.SCREEN_CAPTURE &&
      taskType !== CHROME_EXTENSION_TYPE &&
      !command
    ) {
      throw new Error('Step config missing command');
    }
    if (taskType === CHROME_EXTENSION_TYPE) {
      const cmdJson = command.trim();
      let hasSteps = false;
      if (cmdJson.startsWith('[') || cmdJson.startsWith('{')) {
        try {
          const v = JSON.parse(cmdJson) as unknown;
          const arr = Array.isArray(v)
            ? v
            : v &&
                typeof v === 'object' &&
                Array.isArray((v as { steps?: unknown[] }).steps)
              ? (v as { steps: unknown[] }).steps
              : [];
          hasSteps = arr.length > 0;
        } catch {
          hasSteps = false;
        }
      }
      const hasAction = typeof payload?.action === 'string';
      if (!hasAction && !hasSteps) {
        throw new Error(
          'CHROME_EXTENSION: chọn Hành động hoặc dán JSON nhiều bước',
        );
      }
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
    let telegramRunMeta:
      | {
          runId: string;
          userId: string;
          triggerId: string | null;
          triggerPayload: unknown;
        }
      | undefined;

    if (runOpts?.workflowRunId) {
      const run = await this.prisma.workflowRun.findUnique({
        where: { id: runOpts.workflowRunId },
        select: {
          variables: true,
          triggerType: true,
          triggerId: true,
          triggerPayload: true,
        },
      });
      if (run?.variables && typeof run.variables === 'object') {
        runVars = run.variables as Record<string, unknown>;
      }
      if (
        run?.triggerType === WorkflowTriggerType.TELEGRAM &&
        runOpts.workflowRunId
      ) {
        telegramRunMeta = {
          runId: runOpts.workflowRunId,
          userId,
          triggerId: run.triggerId,
          triggerPayload: run.triggerPayload,
        };
      }
    }

    if (telegramRunMeta) {
      await this.telegramProgress.registerRun({
        runId: telegramRunMeta.runId,
        userId: telegramRunMeta.userId,
        workflowName: workflow.name,
        steps: workflow.steps,
        triggerId: telegramRunMeta.triggerId,
        triggerPayload: telegramRunMeta.triggerPayload,
      });
    }

    const workflowStepDelayMs = Math.max(
      0,
      (workflow as { stepDelayMs?: number }).stepDelayMs ?? 0,
    );

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
        const gap = delayAfterStepMs(step, workflowStepDelayMs);
        if (gap > 0) {
          await sleepMs(gap);
        }
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
