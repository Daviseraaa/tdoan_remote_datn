import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  AgentStatus,
  Prisma,
  Role,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResponseDto,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './dto/admin-user.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const [
      totalUsers,
      adminUsers,
      activeUsers,
      totalAgents,
      onlineAgents,
      offlineAgents,
      busyAgents,
      totalTasks,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      cancelledTasks,
      totalWorkflows,
      activeWorkflows,
      taskTrendRaw,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { status: AgentStatus.ONLINE } }),
      this.prisma.agent.count({ where: { status: AgentStatus.OFFLINE } }),
      this.prisma.agent.count({ where: { status: AgentStatus.BUSY } }),
      this.prisma.task.count(),
      this.prisma.task.count({
        where: { status: { in: [TaskStatus.PENDING, TaskStatus.QUEUED] } },
      }),
      this.prisma.task.count({ where: { status: TaskStatus.RUNNING } }),
      this.prisma.task.count({ where: { status: TaskStatus.COMPLETED } }),
      this.prisma.task.count({
        where: { status: { in: [TaskStatus.FAILED, TaskStatus.TIMEOUT] } },
      }),
      this.prisma.task.count({ where: { status: TaskStatus.CANCELLED } }),
      this.prisma.workflow.count(),
      this.prisma.workflow.count({ where: { isActive: true } }),
      this.buildTaskTrend(7),
    ]);

    return {
      users: { total: totalUsers, admins: adminUsers, active: activeUsers },
      agents: {
        total: totalAgents,
        online: onlineAgents,
        offline: offlineAgents,
        busy: busyAgents,
      },
      tasks: {
        total: totalTasks,
        pending: pendingTasks,
        running: runningTasks,
        completed: completedTasks,
        failed: failedTasks,
        cancelled: cancelledTasks,
      },
      workflows: { total: totalWorkflows, active: activeWorkflows },
      taskTrend: taskTrendRaw,
    };
  }

  private async buildTaskTrend(days: number) {
    const result: Array<{ date: string; completed: number; failed: number }> =
      [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      const [completed, failed] = await Promise.all([
        this.prisma.task.count({
          where: {
            status: TaskStatus.COMPLETED,
            completedAt: { gte: start, lt: end },
          },
        }),
        this.prisma.task.count({
          where: {
            status: { in: [TaskStatus.FAILED, TaskStatus.TIMEOUT] },
            completedAt: { gte: start, lt: end },
          },
        }),
      ]);

      result.push({
        date: `${start.getMonth() + 1}/${start.getDate()}`,
        completed,
        failed,
      });
    }
    return result;
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed,
        role: dto.role ?? Role.USER,
      },
      select: USER_SELECT,
    });
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async listAgents(pagination: PaginationDto, status?: AgentStatus) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.agent.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, pagination);
  }

  async getAgentById(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async deleteAgent(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent not found');
    await this.prisma.agent.delete({ where: { id } });
    return { message: 'Agent deleted', id };
  }

  async regenerateAgentKey(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent not found');

    return this.prisma.agent.update({
      where: { id },
      data: {
        agentKey: cryptoRandom(),
        status: AgentStatus.OFFLINE,
      },
    });
  }

  async listTasks(query: QueryTasksDto) {
    const where: Prisma.TaskWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.agentId && { agentId: query.agentId }),
      ...(query.userId && { userId: query.userId }),
    };
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: { agent: { select: { name: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, query);
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        agent: { select: { name: true, status: true } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async cancelTask(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    const terminalStatuses: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.FAILED,
      TaskStatus.CANCELLED,
      TaskStatus.TIMEOUT,
    ];
    if (terminalStatuses.includes(task.status)) {
      throw new BadRequestException('Task already finished');
    }
    return this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED, completedAt: new Date() },
    });
  }

  async listWorkflows(pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.workflow.findMany({
        include: { steps: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.workflow.count(),
    ]);
    return new PaginatedResponseDto(data, total, pagination);
  }

  validateFilters(dto: QueryTasksDto) {
    if (dto.status && !Object.values(TaskStatus).includes(dto.status)) {
      throw new BadRequestException('Invalid status');
    }
    if (dto.type && !Object.values(TaskType).includes(dto.type)) {
      throw new BadRequestException('Invalid type');
    }
  }
}

function cryptoRandom(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}
