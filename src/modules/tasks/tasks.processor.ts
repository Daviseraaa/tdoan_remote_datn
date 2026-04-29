import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { TaskStatus } from '@prisma/client';
import { TASK_QUEUE, WS_EVENTS } from '../../common/constants/index';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsGateway } from '../agents/agents.gateway';
import { TasksService } from './tasks.service';

@Processor(TASK_QUEUE)
export class TasksProcessor extends WorkerHost {
  private readonly logger = new Logger(TasksProcessor.name);

  constructor(
    private prisma: PrismaService,
    private agentsGateway: AgentsGateway,
    private tasksService: TasksService,
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

    if (task.agent.status !== 'ONLINE') {
      await this.tasksService.addLog(taskId, 'WARN', 'Agent is offline, retrying...');
      throw new Error('Agent is offline');
    }

    await this.tasksService.updateTaskStatus(taskId, TaskStatus.RUNNING);
    await this.tasksService.addLog(taskId, 'INFO', `Dispatching to agent: ${task.agent.name}`);

    this.agentsGateway.emitToAgent(task.agentId, WS_EVENTS.TASK_EXECUTE, {
      taskId: task.id,
      type: task.type,
      command: task.command,
      payload: task.payload,
      timeout: task.timeout,
    });

    const result = await this.waitForResult(taskId, task.timeout);

    if (result) {
      // Gateway đã update DB khi nhận task:result. Processor chỉ log audit.
      this.logger.log(
        `Task ${taskId} resolved by gateway: ${result.status} (exit ${result.exitCode})`,
      );
    } else {
      await this.tasksService.updateTaskStatus(taskId, TaskStatus.TIMEOUT);
      await this.tasksService.addLog(taskId, 'ERROR', 'Task timed out');
    }
  }

  private waitForResult(
    taskId: string,
    timeout: number,
  ): Promise<{ status: string; result: string; exitCode: number } | null> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const task = await this.prisma.task.findUnique({
          where: { id: taskId },
          select: { status: true, result: true, exitCode: true },
        });
        if (
          task &&
          ['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)
        ) {
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
          resolve({
            status: task.status,
            result: task.result || '',
            exitCode: task.exitCode || -1,
          });
        }
      }, 500);

      const timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, timeout);
    });
  }
}
