import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { SubscriptionService } from '../billing/subscription.service';
import { CreateAgentDto, QueryAgentDto, UpdateRemoteAccessDto, WakeAgentDto } from './dto/index';
import { AgentTelemetryStore } from './agent-telemetry.store';
import { WolService } from './wol.service';
import { AgentsGateway } from './agents.gateway';

function asMetaRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

/** Giữ cấu hình WoL/RDP do admin ghi đè khi agent connect lại. */
export function mergeConnectMetadata(
  existing: unknown,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const prev = asMetaRecord(existing);
  const merged: Record<string, unknown> = { ...prev, ...incoming };

  if (prev.wolMacAddressSource === 'admin' && typeof prev.wolMacAddress === 'string') {
    merged.wolMacAddress = prev.wolMacAddress;
    merged.wolMacAddressSource = 'admin';
  }
  if (prev.wolBroadcastSource === 'admin' && typeof prev.wolBroadcast === 'string') {
    merged.wolBroadcast = prev.wolBroadcast;
    merged.wolBroadcastSource = 'admin';
  }
  if (prev.rdpHostSource === 'admin' && typeof prev.rdpHost === 'string') {
    merged.rdpHost = prev.rdpHost;
    merged.rdpHostSource = 'admin';
  }
  if (typeof prev.rdpPort === 'number' && prev.rdpPortSource === 'admin') {
    merged.rdpPort = prev.rdpPort;
    merged.rdpPortSource = 'admin';
  }

  return merged;
}

export function resolveWolMac(metadata: unknown): string | undefined {
  const m = asMetaRecord(metadata);
  const mac = m.wolMacAddress;
  return typeof mac === 'string' && mac.trim() ? mac.trim() : undefined;
}

export function resolveWolBroadcast(metadata: unknown): string | undefined {
  const m = asMetaRecord(metadata);
  const b = m.wolBroadcast;
  return typeof b === 'string' && b.trim() ? b.trim() : undefined;
}

@Injectable()
export class AgentsService {
  private connectedAgents = new Map<string, string>();
  private lastSeenDbAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private telemetry: AgentTelemetryStore,
    private subscription: SubscriptionService,
    private wol: WolService,
    @Inject(forwardRef(() => AgentsGateway))
    private agentsGateway: AgentsGateway,
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

  async findOneById(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
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
    const updated = await this.prisma.agent.update({
      where: { id },
      data: {
        agentKey: randomUUID(),
        status: AgentStatus.OFFLINE,
      },
    });
    await this.agentsGateway.disconnectAgentById(id, 'KEY_REGENERATED');
    return updated;
  }

  async markOnline(agentKey: string, socketId: string, metadata?: Record<string, unknown>) {
    this.connectedAgents.set(agentKey, socketId);

    const agent = await this.prisma.agent.findUnique({ where: { agentKey } });
    const mergedMeta =
      metadata && agent
        ? mergeConnectMetadata(agent.metadata, metadata)
        : metadata;

    return this.prisma.agent.update({
      where: { agentKey },
      data: {
        status: AgentStatus.ONLINE,
        lastSeenAt: new Date(),
        ...(mergedMeta && {
          ip: (mergedMeta.ip as string) ?? undefined,
          os: (mergedMeta.os as string) ?? undefined,
          hostname: (mergedMeta.hostname as string) ?? undefined,
          metadata: mergedMeta as object,
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

    const metadata = mergeConnectMetadata(agent.metadata, {
      ip: snapshot.ip,
      cpuPercent: snapshot.cpuPercent,
      ramUsedBytes: snapshot.ramUsedBytes,
      ramTotalBytes: snapshot.ramTotalBytes,
      ramLabel: snapshot.ramLabel,
      liveTelemetryAt: snapshot.timestamp,
    });

    return this.prisma.agent.update({
      where: { agentKey },
      data: {
        lastSeenAt: new Date(),
        ...(snapshot.ip ? { ip: snapshot.ip } : {}),
        metadata: metadata as object,
      },
    });
  }

  async updateRemoteAccess(
    id: string,
    userId: string | null,
    dto: UpdateRemoteAccessDto,
  ) {
    const agent = userId
      ? await this.findOne(id, userId)
      : await this.findOneById(id);

    const meta = asMetaRecord(agent.metadata);
    const next: Record<string, unknown> = { ...meta };

    if (dto.wolMacAddress !== undefined) {
      if (dto.wolMacAddress.trim() === '') {
        delete next.wolMacAddress;
        delete next.wolMacAddressSource;
      } else {
        next.wolMacAddress = this.wol.normalizeMac(dto.wolMacAddress);
        next.wolMacAddressSource = 'admin';
      }
    }
    if (dto.wolBroadcast !== undefined) {
      if (dto.wolBroadcast.trim() === '') {
        delete next.wolBroadcast;
        delete next.wolBroadcastSource;
      } else {
        next.wolBroadcast = dto.wolBroadcast.trim();
        next.wolBroadcastSource = 'admin';
      }
    }
    if (dto.rdpHost !== undefined) {
      if (dto.rdpHost.trim() === '') {
        delete next.rdpHost;
        delete next.rdpHostSource;
      } else {
        next.rdpHost = dto.rdpHost.trim();
        next.rdpHostSource = 'admin';
      }
    }
    if (dto.rdpPort !== undefined) {
      next.rdpPort = dto.rdpPort;
      next.rdpPortSource = 'admin';
    }
    if (dto.rdpEnabled !== undefined) {
      next.rdpEnabled = dto.rdpEnabled;
    }

    next.remoteAccessUpdatedAt = new Date().toISOString();

    return this.prisma.agent.update({
      where: { id: agent.id },
      data: { metadata: next as object },
    });
  }

  async wakeAgent(id: string, userId: string | null, dto: WakeAgentDto = {}) {
    const agent = userId
      ? await this.findOne(id, userId)
      : await this.findOneById(id);

    const mac =
      (dto.macAddress?.trim() && this.wol.normalizeMac(dto.macAddress)) ||
      resolveWolMac(agent.metadata);

    if (!mac) {
      throw new BadRequestException(
        'Chưa có MAC cho WoL. Agent phải online ít nhất một lần (báo wolMacAddress) hoặc admin cấu hình thủ công.',
      );
    }

    const broadcast =
      dto.broadcast?.trim() ||
      resolveWolBroadcast(agent.metadata) ||
      undefined;

    const sent = await this.wol.sendMagicPacket(mac, {
      broadcast,
      port: dto.port,
    });

    const meta = asMetaRecord(agent.metadata);
    const nextMeta = {
      ...meta,
      lastWakeAt: new Date().toISOString(),
      lastWakeBroadcast: sent.broadcast,
      lastWakePort: sent.port,
    };

    await this.prisma.agent.update({
      where: { id: agent.id },
      data: { metadata: nextMeta as object },
    });

    return {
      ok: true,
      agentId: agent.id,
      macAddress: sent.macAddress,
      broadcast: sent.broadcast,
      port: sent.port,
      message:
        'Đã gửi magic packet. Máy cần bật WoL trên BIOS/NIC; agent có thể online sau 1–3 phút.',
    };
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

  /** Ngắt agent online không thuộc slot gói (sau downgrade / đổi plan). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async enforcePlanAgentLimits() {
    const online = await this.prisma.agent.findMany({
      where: { status: { in: [AgentStatus.ONLINE, AgentStatus.BUSY] } },
      select: { id: true, userId: true, agentKey: true },
    });

    const byUser = new Map<string, typeof online>();
    for (const row of online) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }

    for (const [userId, agents] of byUser) {
      const allowed = await this.subscription.getAllowedAgentIds(userId);
      if (allowed === null) continue;

      for (const agent of agents) {
        if (allowed.has(agent.id)) continue;
        await this.agentsGateway.disconnectAgentById(
          agent.id,
          'PLAN_AGENT_LIMIT',
        );
        this.connectedAgents.delete(agent.agentKey);
        this.lastSeenDbAt.delete(agent.agentKey);
        await this.prisma.agent.update({
          where: { id: agent.id },
          data: { status: AgentStatus.OFFLINE },
        });
      }
    }
  }
}
