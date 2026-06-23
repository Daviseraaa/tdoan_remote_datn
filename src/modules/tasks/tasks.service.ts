import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto, PaginationDto } from '../../common/dto/pagination.dto';
import { TASK_QUEUE } from '../../common/constants/index';
import { notifyTaskCompleted } from '../../common/task-completion-registry';
import { CreateTaskDto, QueryTaskDto, CreateTaskTemplateDto, UpdateTaskTemplateDto } from './dto/index';
import { AgentsGateway } from '../agents/agents.gateway';
import { AgentsService } from '../agents/agents.service';
import { SubscriptionService } from '../billing/subscription.service';

const AGENT_OFFLINE_TASK_MSG = 'Agent đang offline — không gửi task';

const TERMINAL_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.COMPLETED,
  TaskStatus.FAILED,
  TaskStatus.TIMEOUT,
  TaskStatus.CANCELLED,
];

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
    private agentsGateway: AgentsGateway,
    private subscription: SubscriptionService,
    @InjectQueue(TASK_QUEUE) private taskQueue: Queue,
  ) {}

  async create(
    userId: string,
    dto: CreateTaskDto,
    opts?: { workflowRunId?: string },
  ) {
    await this.subscription.assertActive(userId);

    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, userId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found or not owned by user');
    }

    if (!this.agentsService.isAgentReachable(agent)) {
      const task = await this.prisma.task.create({
        data: {
          type: dto.type,
          command: dto.command,
          payload: dto.payload as object,
          priority: dto.priority ?? 0,
          timeout: dto.timeout ?? 300_000,
          status: TaskStatus.FAILED,
          result: AGENT_OFFLINE_TASK_MSG,
          exitCode: -1,
          completedAt: new Date(),
          userId,
          agentId: dto.agentId,
          ...(opts?.workflowRunId
            ? { workflowRunId: opts.workflowRunId }
            : {}),
        },
      });

      await this.addLog(task.id, 'ERROR', AGENT_OFFLINE_TASK_MSG);
      notifyTaskCompleted(task.id, {
        status: TaskStatus.FAILED,
        exitCode: -1,
        result: AGENT_OFFLINE_TASK_MSG,
        error: AGENT_OFFLINE_TASK_MSG,
      });
      this.agentsGateway.emitTaskStatusToUser(
        userId,
        task.id,
        TaskStatus.FAILED,
      );

      return task;
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
        ...(opts?.workflowRunId
          ? { workflowRunId: opts.workflowRunId }
          : {}),
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
    const search = query.search?.trim();
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.agentId && { agentId: query.agentId }),
      ...(search && {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { command: { contains: search, mode: 'insensitive' } },
          { result: { contains: search, mode: 'insensitive' } },
          { agent: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
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

    const wasRunning = task.status === TaskStatus.RUNNING;

    await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED, completedAt: new Date() },
    });

    await this.addLog(id, 'INFO', 'Task cancelled by user');

    if (wasRunning) {
      this.agentsGateway.emitTaskCancel(task.agentId, task.id);
      notifyTaskCompleted(task.id, {
        status: TaskStatus.CANCELLED,
        exitCode: -1,
        result: 'Cancelled by user',
      });
    }

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

  async createTemplate(userId: string, dto: CreateTaskTemplateDto) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: dto.agentId, userId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found or not owned by user');
    }

    return this.prisma.taskTemplate.create({
      data: {
        name: dto.name,
        type: dto.type,
        command: dto.command,
        payload: dto.payload as object | undefined,
        timeout: dto.timeout ?? 300_000,
        priority: dto.priority ?? 0,
        userId,
        agentId: dto.agentId,
      },
      include: {
        agent: { select: { id: true, name: true, status: true } },
      },
    });
  }

  async findAllTemplates(userId: string, query: PaginationDto) {
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.taskTemplate.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, status: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.taskTemplate.count({ where }),
    ]);
    return new PaginatedResponseDto(items, total, query);
  }

  async findAllTemplatesAdmin(query: PaginationDto) {
    const [items, total] = await Promise.all([
      this.prisma.taskTemplate.findMany({
        include: {
          agent: { select: { id: true, name: true, status: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        skip: query.skip,
        take: query.limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.taskTemplate.count(),
    ]);
    return new PaginatedResponseDto(items, total, query);
  }

  findOneTemplate(id: string, userId: string, isAdmin: boolean) {
    return this.prisma.taskTemplate.findFirst({
      where: isAdmin ? { id } : { id, userId },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        ...(isAdmin
          ? { user: { select: { id: true, name: true, email: true } } }
          : {}),
      },
    });
  }

  async getTemplateOrThrow(id: string, userId: string, isAdmin: boolean) {
    const template = await this.findOneTemplate(id, userId, isAdmin);
    if (!template) throw new NotFoundException('Task template not found');
    return template;
  }

  async updateTemplate(
    id: string,
    userId: string,
    isAdmin: boolean,
    dto: UpdateTaskTemplateDto,
  ) {
    const existing = await this.getTemplateOrThrow(id, userId, isAdmin);
    const ownerId = existing.userId;
    if (dto.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, userId: ownerId },
      });
      if (!agent) {
        throw new NotFoundException('Agent not found or not owned by template owner');
      }
    }
    return this.prisma.taskTemplate.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.command !== undefined ? { command: dto.command } : {}),
        ...(dto.payload !== undefined ? { payload: dto.payload as object } : {}),
        ...(dto.timeout !== undefined ? { timeout: dto.timeout } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
      },
      include: {
        agent: { select: { id: true, name: true, status: true } },
        ...(isAdmin
          ? { user: { select: { id: true, name: true, email: true } } }
          : {}),
      },
    });
  }

  async deleteTemplate(id: string, userId: string, isAdmin: boolean) {
    const existing = await this.getTemplateOrThrow(id, userId, isAdmin);
    await this.prisma.taskTemplate.delete({ where: { id: existing.id } });
    return { message: 'Task template deleted' };
  }

  async runTemplate(id: string, requesterUserId: string, isAdmin: boolean) {
    const template = await this.getTemplateOrThrow(id, requesterUserId, isAdmin);
    return this.create(template.userId, {
      type: template.type,
      agentId: template.agentId,
      command: template.command,
      payload: template.payload as Record<string, unknown> | undefined,
      timeout: template.timeout,
      priority: template.priority,
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

  /** Đóng task còn RUNNING/QUEUED/PENDING khi workflow hoặc worker hết thời gian chờ. */
  async markTaskTimedOutIfActive(
    taskId: string,
    message: string,
  ): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, userId: true },
    });
    if (!task || TERMINAL_TASK_STATUSES.includes(task.status)) {
      return false;
    }

    await this.updateTaskStatus(taskId, TaskStatus.TIMEOUT, message);
    await this.addLog(taskId, 'ERROR', message);
    notifyTaskCompleted(taskId, {
      status: TaskStatus.TIMEOUT,
      exitCode: null,
      result: message,
      error: message,
    });
    this.agentsGateway.emitTaskStatusToUser(
      task.userId,
      taskId,
      TaskStatus.TIMEOUT,
    );
    return true;
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
