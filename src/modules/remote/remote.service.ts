import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role, RemoteSessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WS_EVENTS } from '../../common/constants/index';
import { AgentsGateway } from '../agents/agents.gateway';
import { AuditService } from '../admin/audit.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { REMOTE_JWT_TYP } from './remote.constants';
import { CreateRemoteSessionDto } from './dto/create-remote-session.dto';

export interface RemoteSignalJwt {
  typ: typeof REMOTE_JWT_TYP;
  role: 'operator' | 'agent';
  sid: string;
  aid: string;
  sub?: string;
}

@Injectable()
export class RemoteService {
  private readonly logger = new Logger(RemoteService.name);
  private readonly rttHints = new Map<string, { region: string; rttMs: number; at: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly agentsGateway: AgentsGateway,
    private readonly audit: AuditService,
  ) {}

  buildIceServers(
    options?: { preferredRegion?: string; sessionKey?: string },
  ): { urls: string[]; username?: string; credential?: string }[] {
    const urls = this.config.get<string[]>('webrtc.stunUrls', []);
    const turnUrls = this.config.get<string[]>('webrtc.turnUrls', []);
    const turnPoolsByRegion = this.config.get<Record<string, string[]>>(
      'webrtc.turnPoolsByRegion',
      {},
    );
    const user = this.config.get<string>('webrtc.turnUsername', '');
    const credential = this.config.get<string>('webrtc.turnCredential', '');
    const servers: { urls: string[]; username?: string; credential?: string }[] = [];
    if (urls.length) servers.push({ urls });
    const preferred = options?.preferredRegion?.trim().toLowerCase();
    const hinted = options?.sessionKey
      ? this.pickHintedRegion(options.sessionKey)
      : undefined;
    let orderedTurn = [...turnUrls];
    if (preferred && turnPoolsByRegion[preferred]?.length) {
      orderedTurn = [...turnPoolsByRegion[preferred]!, ...orderedTurn];
    } else if (hinted && turnPoolsByRegion[hinted]?.length) {
      orderedTurn = [...turnPoolsByRegion[hinted]!, ...orderedTurn];
    }
    orderedTurn = dedupe(orderedTurn);

    if (orderedTurn.length && user && credential) {
      servers.push({
        urls: orderedTurn,
        username: user,
        credential,
      });
    }
    return servers;
  }

  reportRttHint(
    sessionId: string,
    role: 'operator' | 'agent',
    region: string,
    rttMs: number,
  ) {
    if (!sessionId || !region || !Number.isFinite(rttMs)) return;
    const key = `${sessionId}:${role}`;
    this.rttHints.set(key, {
      region: region.trim().toLowerCase(),
      rttMs,
      at: Date.now(),
    });
  }

  signRemoteToken(
    role: 'operator' | 'agent',
    sessionId: string,
    agentId: string,
    operatorUserId?: string,
  ): string {
    const expiresIn = this.config.get<string>(
      'remote.signalingExpiresIn',
      '15m',
    );
    const payload: RemoteSignalJwt = {
      typ: REMOTE_JWT_TYP,
      role,
      sid: sessionId,
      aid: agentId,
      ...(operatorUserId ? { sub: operatorUserId } : {}),
    };
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
    return this.jwt.sign(
      { ...payload } as Record<string, unknown>,
      {
        secret,
        expiresIn: expiresIn as unknown as number,
      },
    );
  }

  verifyRemoteToken(token: string): RemoteSignalJwt {
    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) throw new ForbiddenException('Server misconfigured');
    const decoded = this.jwt.verify(token, { secret }) as Record<string, unknown>;
    if (decoded.typ !== REMOTE_JWT_TYP) {
      throw new ForbiddenException('Invalid remote token');
    }
    const role = decoded.role as string;
    if (role !== 'operator' && role !== 'agent') {
      throw new ForbiddenException('Invalid remote role');
    }
    const sid = decoded.sid as string;
    const aid = decoded.aid as string;
    if (!sid || !aid) throw new ForbiddenException('Invalid remote payload');
    return {
      typ: REMOTE_JWT_TYP,
      role,
      sid,
      aid,
      sub: decoded.sub as string | undefined,
    };
  }

  private async resolveAgent(actor: JwtPayload, agentId: string) {
    if (actor.role === Role.ADMIN) {
      const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) throw new NotFoundException('Agent not found');
      return agent;
    }
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId: actor.sub },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }

  async createSession(actor: JwtPayload, dto: CreateRemoteSessionDto) {
    const agentId = dto.agentId;
    const controlMode = dto.controlMode || 'full';
    const qualityProfile = dto.qualityProfile || 'balanced';
    const preferredRegion = dto.preferredRegion?.trim().toLowerCase() || undefined;
    const mediaEngine =
      dto.mediaEngine === 'ndc' || dto.mediaEngine === 'wrtc' ? dto.mediaEngine : undefined;
    await this.resolveAgent(actor, agentId);

    const active = await this.prisma.remoteSession.count({
      where: {
        agentId,
        status: { in: [RemoteSessionStatus.PENDING, RemoteSessionStatus.ACTIVE] },
      },
    });
    if (active > 0) {
      throw new ConflictException('Agent already has an active remote session');
    }

    const now = new Date();
    const session = await this.prisma.remoteSession.create({
      data: {
        agentId,
        operatorId: actor.sub,
        status: RemoteSessionStatus.ACTIVE,
        controlMode,
        startedAt: now,
        lastHeartbeatAt: now,
      },
    });

    const operatorToken = this.signRemoteToken(
      'operator',
      session.id,
      agentId,
      actor.sub,
    );
    const agentToken = this.signRemoteToken('agent', session.id, agentId);

    const iceServers = this.buildIceServers({
      preferredRegion,
      sessionKey: `${session.id}:operator`,
    });

    this.agentsGateway.emitToAgent(agentId, WS_EVENTS.REMOTE_SESSION, {
      sessionId: session.id,
      agentSignalingToken: agentToken,
      iceServers,
      qualityProfile,
      preferredRegion,
      ...(mediaEngine !== undefined ? { mediaEngine } : {}),
    });

    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'REMOTE_SESSION_CREATE',
      resource: 'RemoteSession',
      resourceId: session.id,
      metadata: { agentId, controlMode, qualityProfile, preferredRegion, mediaEngine },
    });

    return {
      session: this.sanitizeSession(session),
      operatorSignalingToken: operatorToken,
      iceServers,
      qualityProfile,
      preferredRegion,
      ...(mediaEngine !== undefined ? { mediaEngine } : {}),
    };
  }

  private pickHintedRegion(sessionKey: string): string | undefined {
    const ttlMs = this.config.get<number>('remote.rttHintTtlSec', 120) * 1000;
    const now = Date.now();
    const hints = Array.from(this.rttHints.entries())
      .filter(([k, v]) => k.startsWith(sessionKey) && now - v.at <= ttlMs)
      .map(([, v]) => v);
    if (!hints.length) return undefined;
    hints.sort((a, b) => a.rttMs - b.rttMs);
    return hints[0]!.region;
  }

  async getSession(actor: JwtPayload, sessionId: string) {
    const session = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      actor.role !== Role.ADMIN &&
      session.operatorId !== actor.sub
    ) {
      throw new ForbiddenException('Not allowed to view this session');
    }
    return this.sanitizeSession(session);
  }

  async stopSession(actor: JwtPayload, sessionId: string, ip?: string | null) {
    const session = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      actor.role !== Role.ADMIN &&
      session.operatorId !== actor.sub
    ) {
      throw new ForbiddenException('Not allowed to stop this session');
    }
    await this.finalizeSession(sessionId, 'ENDED', 'operator_stop');
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'REMOTE_SESSION_STOP',
      resource: 'RemoteSession',
      resourceId: sessionId,
      metadata: { agentId: session.agentId },
      ip: ip ?? null,
    });
    return { ok: true };
  }

  async panicStop(actor: JwtPayload, sessionId: string, ip?: string | null) {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    const session = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    await this.finalizeSession(sessionId, 'ENDED', 'panic');
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'REMOTE_SESSION_PANIC',
      resource: 'RemoteSession',
      resourceId: sessionId,
      metadata: { agentId: session.agentId },
      ip: ip ?? null,
    });
    return { ok: true };
  }

  async heartbeatRest(actor: JwtPayload, sessionId: string) {
    const session = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (
      actor.role !== Role.ADMIN &&
      session.operatorId !== actor.sub
    ) {
      throw new ForbiddenException('Not allowed');
    }
    if (session.status !== RemoteSessionStatus.ACTIVE) {
      throw new ConflictException('Session not active');
    }
    await this.touchHeartbeat(sessionId);
    return { ok: true };
  }

  async verifyAgentForSession(agentId: string, agentKey: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.agentKey !== agentKey) {
      throw new ForbiddenException('Invalid agent credentials');
    }
    return agent;
  }

  async assertSessionActive(sessionId: string) {
    const s = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (!s || s.status !== RemoteSessionStatus.ACTIVE) {
      throw new ForbiddenException('Remote session invalid');
    }
    return s;
  }

  async touchHeartbeat(sessionId: string) {
    await this.prisma.remoteSession.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: new Date() },
    });
  }

  async finalizeSession(
    sessionId: string,
    status: 'ENDED' | 'FAILED',
    reason: string,
  ) {
    const session = await this.prisma.remoteSession.updateMany({
      where: {
        id: sessionId,
        status: RemoteSessionStatus.ACTIVE,
      },
      data: {
        status: status as RemoteSessionStatus,
        endedAt: new Date(),
      },
    });
    if (session.count === 0) return;
    const payload = { sessionId, reason };
    try {
      this.agentsGateway.server
        .of('/ws/remote')
        .to(`remote:${sessionId}`)
        .emit(WS_EVENTS.REMOTE_END, payload);
    } catch (e) {
      this.logger.warn(`emit remote end: ${(e as Error).message}`);
    }
    const row = await this.prisma.remoteSession.findUnique({
      where: { id: sessionId },
    });
    if (row) {
      this.agentsGateway.emitToAgent(row.agentId, WS_EVENTS.REMOTE_END, payload);
    }
  }

  sanitizeSession(session: {
    id: string;
    status: RemoteSessionStatus;
    agentId: string;
    operatorId: string;
    controlMode: string;
    startedAt: Date | null;
    endedAt: Date | null;
    lastHeartbeatAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: session.id,
      status: session.status,
      agentId: session.agentId,
      operatorId: session.operatorId,
      controlMode: session.controlMode,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      createdAt: session.createdAt,
    };
  }

  auditControlMeta(body: Record<string, unknown>): Record<string, unknown> {
    const type = String(body.type ?? 'unknown');
    if (type === 'KEYBOARD' || type === 'TEXT' || type === 'CLIPBOARD') {
      const text = body.text;
      const len =
        typeof text === 'string' ? text.length : typeof text === 'number' ? 1 : 0;
      return { type, len };
    }
    return { type };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStaleSessions() {
    const sec = this.config.get<number>('remote.sessionHeartbeatSec', 45);
    const threshold = new Date(Date.now() - sec * 1000);
    const stale = await this.prisma.remoteSession.findMany({
      where: {
        status: RemoteSessionStatus.ACTIVE,
        lastHeartbeatAt: { lt: threshold },
      },
      select: { id: true, agentId: true },
    });
    for (const s of stale) {
      await this.finalizeSession(s.id, 'FAILED', 'heartbeat_timeout');
      await this.audit.record({
        action: 'REMOTE_SESSION_TIMEOUT',
        resource: 'RemoteSession',
        resourceId: s.id,
        metadata: { agentId: s.agentId },
      });
    }
  }
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}
