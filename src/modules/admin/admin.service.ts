import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  AgentStatus,
  PaymentStatus,
  Prisma,
  Role,
  SubscriptionStatus,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResponseDto,
  PaginationDto,
} from '../../common/dto/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './dto/admin-user.dto';
import { CreateAdminPlanDto, UpdateAdminPlanDto } from './dto/admin-plan.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryWorkflowRunsDto } from './dto/query-workflow-runs.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { notifyTaskCompleted } from '../../common/task-completion-registry';
import { AgentTelemetryStore } from '../agents/agent-telemetry.store';
import { AgentsGateway } from '../agents/agents.gateway';
import { SubscriptionService } from '../billing/subscription.service';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  subscriptionStatus: true,
  subscriptionExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  plan: {
    select: {
      id: true,
      name: true,
      originalPriceVnd: true,
      priceVnd: true,
      durationDays: true,
      maxAgents: true,
      description: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private telemetry: AgentTelemetryStore,
    private subscription: SubscriptionService,
    private agentsGateway: AgentsGateway,
  ) {}

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
      subscriptionCounts,
      workflowRunsByTrigger,
      paymentTrendRaw,
      recentWorkflowRuns,
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
      this.buildSubscriptionCounts(),
      this.buildWorkflowRunsByTrigger(),
      this.buildPaymentTrend(7),
      this.prisma.workflowRun.count({
        where: {
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
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
      subscriptions: subscriptionCounts,
      workflowRunsByTrigger,
      paymentTrend: paymentTrendRaw,
      workflowRunsLast24h: recentWorkflowRuns,
    };
  }

  private async buildSubscriptionCounts() {
    const [trial, active, expired, cancelled] = await Promise.all([
      this.prisma.user.count({
        where: { role: Role.USER, subscriptionStatus: SubscriptionStatus.TRIAL },
      }),
      this.prisma.user.count({
        where: { role: Role.USER, subscriptionStatus: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { role: Role.USER, subscriptionStatus: SubscriptionStatus.EXPIRED },
      }),
      this.prisma.user.count({
        where: { role: Role.USER, subscriptionStatus: SubscriptionStatus.CANCELLED },
      }),
    ]);
    return { trial, active, expired, cancelled };
  }

  private async buildWorkflowRunsByTrigger() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.workflowRun.groupBy({
      by: ['triggerType'],
      where: { startedAt: { gte: since } },
      _count: { id: true },
    });
    const map: Record<string, number> = {
      MANUAL: 0,
      SCHEDULE: 0,
      TELEGRAM: 0,
      UNKNOWN: 0,
    };
    for (const row of rows) {
      const key = row.triggerType ?? 'UNKNOWN';
      map[key] = row._count.id;
    }
    return Object.entries(map).map(([triggerType, count]) => ({
      triggerType,
      count,
    }));
  }

  private async buildPaymentTrend(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        paidAt: { gte: since },
      },
      select: { paidAt: true, amountVnd: true },
    });
    const buckets = new Map<string, { count: number; amountVnd: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { count: 0, amountVnd: 0 });
    }
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = p.paidAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.count += 1;
      b.amountVnd += p.amountVnd;
    }
    return [...buckets.entries()].map(([date, v]) => ({
      date,
      count: v.count,
      amountVnd: v.amountVnd,
    }));
  }

  /** Bucket 5 phút trong `days` ngày — client lọc 1H / 24H / 7D, không gọi lại API. */
  private async buildTaskTrend(days: number) {
    const BUCKET_MS = 5 * 60 * 1000;
    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const startMs = Math.floor(rangeStart.getTime() / BUCKET_MS) * BUCKET_MS;
    const endMs = Math.floor(now.getTime() / BUCKET_MS) * BUCKET_MS;

    const buckets = new Map<number, { completed: number; failed: number }>();
    for (let t = startMs; t <= endMs; t += BUCKET_MS) {
      buckets.set(t, { completed: 0, failed: 0 });
    }

    const tasks = await this.prisma.task.findMany({
      where: {
        completedAt: { gte: new Date(startMs), lte: now },
        status: {
          in: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.TIMEOUT],
        },
      },
      select: { status: true, completedAt: true },
    });

    for (const task of tasks) {
      if (!task.completedAt) continue;
      const key = Math.floor(task.completedAt.getTime() / BUCKET_MS) * BUCKET_MS;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (task.status === TaskStatus.COMPLETED) bucket.completed += 1;
      else bucket.failed += 1;
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([t, counts]) => {
        const d = new Date(t);
        return {
          at: d.toISOString(),
          date: `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
          completed: counts.completed,
          failed: counts.failed,
        };
      });
  }

  async listUsers(pagination: PaginationDto) {
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        select: USER_SELECT,
      }),
      this.prisma.user.count(),
    ]);
    return new PaginatedResponseDto(data, total, pagination);
  }

  async listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { priceVnd: 'asc' },
    });
  }

  private assertPlanPrices(originalPriceVnd: number, priceVnd: number) {
    if (originalPriceVnd < priceVnd) {
      throw new BadRequestException('Giá gốc không được thấp hơn giá bán');
    }
  }

  async createPlan(dto: CreateAdminPlanDto) {
    this.assertPlanPrices(dto.originalPriceVnd, dto.priceVnd);
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        originalPriceVnd: dto.originalPriceVnd,
        priceVnd: dto.priceVnd,
        durationDays: dto.durationDays ?? 30,
        maxAgents: dto.maxAgents ?? 3,
        description: dto.description,
        isActive: dto.isActive ?? true,
        isTrial: false,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateAdminPlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (plan.isTrial) {
      if (dto.isActive === false) {
        throw new BadRequestException('Không thể tắt gói trial hệ thống');
      }
      if (dto.priceVnd != null && dto.priceVnd !== 0) {
        throw new BadRequestException('Gói trial phải miễn phí (priceVnd = 0)');
      }
      if (dto.originalPriceVnd != null && dto.originalPriceVnd !== 0) {
        throw new BadRequestException('Gói trial phải miễn phí (originalPriceVnd = 0)');
      }
    }

    const originalPriceVnd = dto.originalPriceVnd ?? plan.originalPriceVnd;
    const priceVnd = dto.priceVnd ?? plan.priceVnd;
    this.assertPlanPrices(originalPriceVnd, priceVnd);

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: dto,
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (plan.isTrial) {
      throw new BadRequestException('Không thể xóa gói trial hệ thống');
    }

    const paymentCount = await this.prisma.payment.count({ where: { planId: id } });
    if (paymentCount > 0) {
      throw new BadRequestException(
        'Không thể xóa gói đã có giao dịch thanh toán. Hãy ngừng bán (tắt isActive) thay vì xóa.',
      );
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { message: 'Plan deleted', id };
  }

  async listWorkflowRuns(query: QueryWorkflowRunsDto) {
    const where: Prisma.WorkflowRunWhereInput = {
      ...(query.userId && { userId: query.userId }),
      ...(query.status && { status: query.status }),
      ...(query.triggerType && { triggerType: query.triggerType }),
    };
    const [data, total] = await Promise.all([
      this.prisma.workflowRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          workflow: { select: { id: true, name: true, isActive: true } },
        },
      }),
      this.prisma.workflowRun.count({ where }),
    ]);
    return new PaginatedResponseDto(data, total, query);
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed,
        role: dto.role ?? Role.USER,
      },
      select: USER_SELECT,
    });
    if (user.role === Role.USER) {
      await this.subscription.startTrial(user.id);
      const refreshed = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: USER_SELECT,
      });
      return refreshed ?? user;
    }
    return user;
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
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);
    return new PaginatedResponseDto(
      this.telemetry.enrichMany(data),
      total,
      pagination,
    );
  }

  async getAgentById(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.telemetry.enrich(agent);
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

    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        agentKey: cryptoRandom(),
        status: AgentStatus.OFFLINE,
      },
    });
    await this.agentsGateway.disconnectAgentById(id, 'KEY_REGENERATED');
    return updated;
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

    const wasRunning = task.status === TaskStatus.RUNNING;

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.CANCELLED, completedAt: new Date() },
    });

    await this.prisma.taskLog.create({
      data: {
        taskId: id,
        level: 'INFO',
        message: 'Task cancelled by admin',
      },
    });

    if (wasRunning) {
      this.agentsGateway.emitTaskCancel(task.agentId, task.id);
      notifyTaskCompleted(task.id, {
        status: TaskStatus.CANCELLED,
        exitCode: -1,
        result: 'Cancelled by admin',
      });
    }

    return updated;
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

  async listPayments(query: QueryPaymentsDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.userId && { userId: query.userId }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
        select: {
          id: true,
          amountVnd: true,
          status: true,
          orderCode: true,
          paymentCode: true,
          paidAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, name: true } },
          plan: {
            select: { id: true, name: true, durationDays: true, priceVnd: true },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    const data = rows.map((row) => ({
      ...row,
      orderCode: row.orderCode.toString(),
    }));
    return new PaginatedResponseDto(data, total, query);
  }
}

function cryptoRandom(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}
