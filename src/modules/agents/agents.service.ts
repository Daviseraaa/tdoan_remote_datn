import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { SubscriptionService } from '../billing/subscription.service';
import { CreateAgentDto, QueryAgentDto } from './dto/index';
import { AgentTelemetryStore } from './agent-telemetry.store';

@Injectable()
export class AgentsService {
  private connectedAgents = new Map<string, string>();
  private lastSeenDbAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private telemetry: AgentTelemetryStore,
    private subscription: SubscriptionService,
  ) {}

  async create(userId: string, dto: CreateAgentDto) {
    await this.subscription.assertCanAddAgent(userId);
    return this.prisma.agent.create({
      data: {
        name: dto.name,
        os: dto.os,
        hostname: dto.hostname,
        userId,
      },
    });
  }

  async findAll(userId: string, query: QueryAgentDto) {
    const where = {
      userId,
      ...(query.status && { status: query.status }),
    };

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return new PaginatedResponseDto(
      this.telemetry.enrichMany(agents),
      total,
      query,
    );
  }

  async findOne(id: string, userId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return this.telemetry.enrich(agent);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.agent.delete({ where: { id } });
    return { message: 'Agent deleted successfully' };
  }

  async regenerateKey(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.agent.update({
      where: { id },
      data: {
        agentKey: randomUUID(),
        status: AgentStatus.OFFLINE,
      },
    });
  }

  async markOnline(agentKey: string, socketId: string, metadata?: Record<string, unknown>) {
    this.connectedAgents.set(agentKey, socketId);
    return this.prisma.agent.update({
      where: { agentKey },
      data: {
        status: AgentStatus.ONLINE,
        lastSeenAt: new Date(),
        ...(metadata && {
          ip: metadata.ip as string,
          os: metadata.os as string,
          hostname: metadata.hostname as string,
          metadata: metadata as object,
        }),
      },
    });
  }

  async markOffline(agentKey: string) {
    this.connectedAgents.delete(agentKey);
    const agent = await this.prisma.agent.findUnique({ where: { agentKey } });
    if (agent) {
      this.telemetry.delete(agent.id);
      this.lastSeenDbAt.delete(agentKey);
    }
    return this.prisma.agent.update({
      where: { agentKey },
      data: { status: AgentStatus.OFFLINE },
    });
  }

  /**
   * Cập nhật lastSeenAt tối đa mỗi 30s.
   * Kèm snapshot telemetry → merge vào `metadata` (để admin đọc khi agent OFFLINE).
   */
  async heartbeat(
    agentKey: string,
    snapshot?: {
      ip: string;
      cpuPercent: number;
      ramUsedBytes: number;
      ramTotalBytes: number;
      ramLabel: string;
      timestamp: number;
    },
  ) {
    const now = Date.now();
    const last = this.lastSeenDbAt.get(agentKey) ?? 0;
    if (now - last < 30_000) return null;
    this.lastSeenDbAt.set(agentKey, now);

    if (!snapshot) {
      return this.prisma.agent.update({
        where: { agentKey },
        data: { lastSeenAt: new Date() },
      });
    }

    const agent = await this.prisma.agent.findUnique({ where: { agentKey } });
    if (!agent) return null;

    const baseMeta =
      agent.metadata &&
      typeof agent.metadata === 'object' &&
      !Array.isArray(agent.metadata)
        ? { ...(agent.metadata as Record<string, unknown>) }
        : {};

    const metadata = {
      ...baseMeta,
      ip: snapshot.ip,
      cpuPercent: snapshot.cpuPercent,
      ramUsedBytes: snapshot.ramUsedBytes,
      ramTotalBytes: snapshot.ramTotalBytes,
      ramLabel: snapshot.ramLabel,
      liveTelemetryAt: snapshot.timestamp,
    };

    return this.prisma.agent.update({
      where: { agentKey },
      data: {
        lastSeenAt: new Date(),
        ...(snapshot.ip ? { ip: snapshot.ip } : {}),
        metadata: metadata as object,
      },
    });
  }

  getSocketId(agentKey: string): string | undefined {
    return this.connectedAgents.get(agentKey);
  }

  isOnline(agentKey: string): boolean {
    return this.connectedAgents.has(agentKey);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkStaleAgents() {
    const threshold = new Date(Date.now() - 60_000);
    await this.prisma.agent.updateMany({
      where: {
        status: AgentStatus.ONLINE,
        lastSeenAt: { lt: threshold },
      },
      data: { status: AgentStatus.OFFLINE },
    });
  }
}
