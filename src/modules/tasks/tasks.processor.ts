import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TaskStatus, TaskType } from '@prisma/client';
import { TASK_QUEUE, WS_EVENTS } from '../../common/constants/index';
import {
  notifyTaskCompleted,
  registerTaskCompletionWaiter,
} from '../../common/task-completion-registry';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsGateway } from '../agents/agents.gateway';
import { AgentsService } from '../agents/agents.service';
import { SubscriptionService } from '../billing/subscription.service';
import { TasksService } from './tasks.service';
import { resolveScreenCaptureEmitPayload } from './tasks-screen-capture.util';
import { resolveTelegramSendEmitPayload } from './tasks-telegram-send.util';

const TASK_WORKER_CONCURRENCY = Math.max(
  1,
  parseInt(process.env.TASK_WORKER_CONCURRENCY ?? '10', 10) || 10,
);

@Processor(TASK_QUEUE, { concurrency: TASK_WORKER_CONCURRENCY })
export class TasksProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksProcessor.name);

  constructor(
    private prisma: PrismaService,
    private agentsGateway: AgentsGateway,
    private agentsService: AgentsService,
    private tasksService: TasksService,
    private subscription: SubscriptionService,
  ) {
    super();
  }

  async process(job: Job<{ taskId: string }>) {
    const { taskId } = job.data;
    this.logger.log(`Processing task: ${taskId}`);

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { agent: true },
    });

    if (!task) {
      this.logger.error(`Task not found: ${taskId}`);
      return;
    }

    if (task.status === TaskStatus.CANCELLED) {
      this.logger.log(`Task already cancelled: ${taskId}`);
      return;
    }

    try {
      await this.subscription.assertActive(task.userId);
    } catch {
      await this.tasksService.updateTaskStatus(taskId, TaskStatus.FAILED);
      await this.tasksService.addLog(
        taskId,
        'ERROR',
        'Subscription expired — task not dispatched',
      );
      return;
    }

    if (!this.agentsService.isAgentReachable(task.agent)) {
      const message = 'Agent đang offline — không gửi task';
      await this.tasksService.updateTaskStatus(
        taskId,
        TaskStatus.FAILED,
        message,
        -1,
      );
      await this.tasksService.addLog(taskId, 'ERROR', message);
      notifyTaskCompleted(taskId, {
        status: TaskStatus.FAILED,
        exitCode: -1,
        result: message,
        error: message,
      });
      this.agentsGateway.emitTaskStatusToUser(
        task.userId,
        taskId,
        TaskStatus.FAILED,
      );
      return;
    }

    await this.tasksService.updateTaskStatus(taskId, TaskStatus.RUNNING);
    await this.tasksService.addLog(taskId, 'INFO', `Dispatching to agent: ${task.agent.name}`);
    this.agentsGateway.emitTaskStatusToUser(task.userId, taskId, TaskStatus.RUNNING);

    let emitPayload: unknown = task.payload;
    if (task.type === TaskType.SCREEN_CAPTURE) {
      emitPayload = await resolveScreenCaptureEmitPayload(
        this.prisma,
        task.userId,
        task.payload,
      );
    } else if (task.type === TaskType.TELEGRAM_SEND) {
      emitPayload = await resolveTelegramSendEmitPayload(
        this.prisma,
        task.userId,
        task.payload,
      );
    }

    this.agentsGateway.emitToAgent(task.agentId, WS_EVENTS.TASK_EXECUTE, {
      taskId: task.id,
      type: task.type,
      command: task.command,
      payload: emitPayload,
      timeout: task.timeout,
    });

    const outcome = await registerTaskCompletionWaiter(taskId, task.timeout);

    if (outcome.status === TaskStatus.TIMEOUT) {
      await this.tasksService.markTaskTimedOutIfActive(
        taskId,
        outcome.error ?? 'Task timed out',
      );
    } else {
      // Gateway đã update DB khi nhận task:result. Processor chỉ log audit.
      this.logger.log(
        `Task ${taskId} resolved by gateway: ${outcome.status} (exit ${outcome.exitCode})`,
      );
    }
  }
}
