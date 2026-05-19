import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { TASK_QUEUE } from '../../common/constants/index';
import { CreateTaskDto, QueryTaskDto } from './dto/index';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
    @InjectQueue(TASK_QUEUE) private taskQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateTaskDto) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, userId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found or not owned by user');
    }

    const task = await this.prisma.task.create({
      data: {
        type: dto.type,
        command: dto.command,
        payload: dto.payload as object,
        priority: dto.priority ?? 0,
        timeout: dto.timeout ?? 300_000,
        status: TaskStatus.PENDING,
        userId,
        agentId: dto.agentId,
      },
    });

    await this.enqueueExecute(task.id, dto.priority ?? 0);

    await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.QUEUED },
    });

    await this.addLog(task.id, 'INFO', 'Task created and queued');

    return { ...task, status: TaskStatus.QUEUED };
  }

  async findAll(userId: string, query: QueryTaskDto) {
    const where = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.agentId && { agentId: query.agentId }),
    };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: { agent: { select: { name: true, status: true } } },
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    return new PaginatedResponseDto(tasks, total, query);
  }

  async findOne(id: string, userId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: {
        agent: { select: { name: true, status: true } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async cancel(id: string, userId: string) {
    const task = await this.findOne(id, userId);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException('Task is already in a terminal state');
    }

    await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED, completedAt: new Date() },
    });

    await this.addLog(id, 'INFO', 'Task cancelled by user');
    return { message: 'Task cancelled' };
  }

  /** Chạy lại task đã kết thúc — xếp hàng BullMQ và gửi lại agent. */
  async retry(id: string, userId?: string) {
    const task = await this.prisma.task.findFirst({
      where: userId ? { id, userId } : { id },
    });
    if (!task) throw new NotFoundException('Task not found');

    const retriable: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.FAILED,
      TaskStatus.TIMEOUT,
      TaskStatus.CANCELLED,
    ];
    if (!retriable.includes(task.status)) {
      throw new BadRequestException(
        'Chỉ chạy lại task đã kết thúc (COMPLETED, FAILED, TIMEOUT, CANCELLED)',
      );
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.PENDING,
        result: null,
        exitCode: null,
        startedAt: null,
        completedAt: null,
        retryCount: { increment: 1 },
      },
    });

    await this.enqueueExecute(id, task.priority);

    await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.QUEUED },
    });

    await this.addLog(id, 'INFO', 'Task re-queued (manual retry)');

    if (userId) {
      return this.findOne(id, userId);
    }

    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        agent: { select: { name: true, status: true } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async enqueueExecute(taskId: string, priority: number) {
    await this.taskQueue.add(
      'execute',
      { taskId },
      {
        priority,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
  }

  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: string,
    exitCode?: number,
  ) {
    const data: Record<string, unknown> = { status };
    if (status === TaskStatus.RUNNING) data.startedAt = new Date();
    if (['COMPLETED', 'FAILED', 'TIMEOUT'].includes(status)) {
      data.completedAt = new Date();
    }
    if (result !== undefined) data.result = result;
    if (exitCode !== undefined) data.exitCode = exitCode;

    return this.prisma.task.update({ where: { id: taskId }, data });
  }

  async incrementRetry(taskId: string) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { retryCount: { increment: 1 } },
    });
  }

  async addLog(taskId: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string) {
    return this.prisma.taskLog.create({
      data: { taskId, level, message },
    });
  }
}
