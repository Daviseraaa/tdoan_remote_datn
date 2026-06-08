import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TaskStatus, TaskType } from '@prisma/client';
import { TASK_QUEUE, WS_EVENTS } from '../../common/constants/index';
import { registerTaskCompletionWaiter } from '../../common/task-completion-registry';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsGateway } from '../agents/agents.gateway';
import { SubscriptionService } from '../billing/subscription.service';
import { TasksService } from './tasks.service';
import { resolveScreenCaptureEmitPayload } from './tasks-screen-capture.util';

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

    if (task.agent.status !== 'ONLINE') {
      await this.tasksService.addLog(taskId, 'WARN', 'Agent is offline, retrying...');
      throw new Error('Agent is offline');
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
    }

    this.agentsGateway.emitToAgent(task.agentId, WS_EVENTS.TASK_EXECUTE, {
      taskId: task.id,
      type: task.type,
      command: task.command,
      payload: emitPayload,
      timeout: task.timeout,
    });

    const outcome = await registerTaskCompletionWaiter(taskId, task.timeout).catch(
      () => null,
    );

    if (outcome) {
      // Gateway đã update DB khi nhận task:result. Processor chỉ log audit.
      this.logger.log(
        `Task ${taskId} resolved by gateway: ${outcome.status} (exit ${outcome.exitCode})`,
      );
    } else {
      await this.tasksService.updateTaskStatus(taskId, TaskStatus.TIMEOUT);
      await this.tasksService.addLog(taskId, 'ERROR', 'Task timed out');
    }
  }
}
