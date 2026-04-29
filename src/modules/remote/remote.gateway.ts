import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RemoteSessionStatus } from '@prisma/client';
import { WS_EVENTS } from '../../common/constants/index';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RemoteService } from './remote.service';
import { AgentsGateway } from '../agents/agents.gateway';
import { AuditService } from '../admin/audit.service';
import { TelegramActionNotifierService } from '../../common/logging/telegram-action-notifier.service';

type RemoteSocket = Socket & {
  data: {
    sessionId?: string;
    role?: 'operator' | 'agent';
    agentId?: string;
  };
};

@WebSocketGateway({
  namespace: '/ws/remote',
  cors: { origin: '*' },
})
/** Global ValidationPipe (whitelist) có thể làm rỗng body WS → không relay telemetry/ICE. */
@UsePipes(
  new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
  }),
)
export class RemoteGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RemoteGateway.name);
  private readonly controlBuckets = new Map<
    string,
    { windowStart: number; count: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly remote: RemoteService,
    private readonly agentsGateway: AgentsGateway,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly actionNotifier: TelegramActionNotifierService,
  ) {}

  async handleConnection(client: RemoteSocket) {
    const token =
      client.handshake?.auth?.token || client.handshake?.query?.token;
    if (!token || typeof token !== 'string') {
      this.logger.warn('remote ws: missing token');
      client.disconnect();
      return;
    }

    let claims: ReturnType<RemoteService['verifyRemoteToken']>;
    try {
      claims = this.remote.verifyRemoteToken(token);
    } catch (e) {
      this.logger.warn(`remote ws: bad token ${(e as Error).message}`);
      client.disconnect();
      return;
    }

    const session = await this.prisma.remoteSession.findUnique({
      where: { id: claims.sid },
    });
    if (!session || session.status !== RemoteSessionStatus.ACTIVE) {
      this.logger.warn('remote ws: session not active');
      client.disconnect();
      return;
    }
    if (session.agentId !== claims.aid) {
      client.disconnect();
      return;
    }

    if (claims.role === 'operator') {
      if (!claims.sub || claims.sub !== session.operatorId) {
        client.disconnect();
        return;
      }
    } else {
      const agentKey =
        client.handshake?.auth?.agentKey || client.handshake?.query?.agentKey;
      if (!agentKey || typeof agentKey !== 'string') {
        client.disconnect();
        return;
      }
      try {
        await this.remote.verifyAgentForSession(session.agentId, agentKey);
      } catch {
        client.disconnect();
        return;
      }
    }

    client.data = {
      sessionId: session.id,
      role: claims.role,
      agentId: session.agentId,
    };
    await client.join(`remote:${session.id}`);
    await this.remote.touchHeartbeat(session.id);
    client.emit(WS_EVENTS.REMOTE_READY, { sessionId: session.id });
    this.logger.log(`remote ws connected ${claims.role} session=${session.id}`);
    await this.actionNotifier.notify('remote.client.connected', {
      sessionId: session.id,
      role: claims.role,
      agentId: session.agentId,
    });
  }

  async handleDisconnect(client: RemoteSocket) {
    this.controlBuckets.delete(client.id);
    if (client.data.sessionId) {
      await this.actionNotifier.notify('remote.client.disconnected', {
        sessionId: client.data.sessionId,
        role: client.data.role,
        agentId: client.data.agentId,
      });
    }
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_OFFER)
  relayOffer(
    @ConnectedSocket() client: RemoteSocket,
    @MessageBody() body: { payload?: unknown },
  ) {
    return this.relay(client, WS_EVENTS.REMOTE_OFFER, body?.payload);
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_ANSWER)
  relayAnswer(
    @ConnectedSocket() client: RemoteSocket,
    @MessageBody() body: { payload?: unknown },
  ) {
    return this.relay(client, WS_EVENTS.REMOTE_ANSWER, body?.payload);
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_ICE)
  relayIce(
    @ConnectedSocket() client: RemoteSocket,
    @MessageBody() body: { payload?: unknown },
  ) {
    return this.relay(client, WS_EVENTS.REMOTE_ICE, body?.payload);
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_HEARTBEAT)
  async heartbeat(@ConnectedSocket() client: RemoteSocket) {
    const sid = client.data.sessionId;
    if (!sid) return { ok: false };
    try {
      await this.remote.assertSessionActive(sid);
      await this.remote.touchHeartbeat(sid);
    } catch {
      return { ok: false };
    }
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_CONTROL)
  async control(
    @ConnectedSocket() client: RemoteSocket,
    @MessageBody() body: Record<string, unknown>,
  ) {
    if (client.data.role !== 'operator') {
      return { ok: false, error: 'forbidden' };
    }
    const sid = client.data.sessionId;
    const agentId = client.data.agentId;
    if (!sid || !agentId) return { ok: false };

    const maxPerSec = this.config.get<number>('remote.controlMaxPerSec', 60);
    if (!this.allowControl(client.id, maxPerSec)) {
      return { ok: false, error: 'throttled' };
    }

    try {
      await this.remote.assertSessionActive(sid);
    } catch {
      return { ok: false, error: 'session' };
    }

    const meta = this.remote.auditControlMeta(body || {});
    const t = String((body || {}).type ?? '');
    if (t && t !== 'MOUSE_MOVE') {
      await this.audit.record({
        action: 'REMOTE_CONTROL',
        resource: 'RemoteSession',
        resourceId: sid,
        metadata: meta,
      });
    }

    this.agentsGateway.emitToAgent(agentId, WS_EVENTS.REMOTE_CONTROL, body);
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_TELEMETRY)
  telemetry(@ConnectedSocket() client: RemoteSocket, @MessageBody() body: unknown) {
    if (client.data.role !== 'agent') return { ok: false, error: 'forbidden' };
    const sid = client.data.sessionId;
    if (!sid) return { ok: false };
    const payload = extractTelemetryPayload(body);
    if (!payload) {
      this.logger.warn('remote telemetry: empty payload after parse');
      return { ok: false, error: 'empty' };
    }
    client.to(`remote:${sid}`).emit(WS_EVENTS.REMOTE_TELEMETRY, { payload });
    return { ok: true };
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_RTT_REPORT)
  rttReport(
    @ConnectedSocket() client: RemoteSocket,
    @MessageBody() body: { region?: string; rttMs?: number },
  ) {
    const sid = client.data.sessionId;
    const role = client.data.role;
    if (!sid || !role || !body?.region || !Number.isFinite(body.rttMs)) {
      return { ok: false };
    }
    this.remote.reportRttHint(sid, role, body.region, Number(body.rttMs));
    return { ok: true };
  }

  private relay(client: RemoteSocket, event: string, payload: unknown) {
    const sid = client.data.sessionId;
    if (!sid || payload === undefined) {
      return { ok: false };
    }
    client.to(`remote:${sid}`).emit(event, { payload });
    return { ok: true };
  }

  private allowControl(socketId: string, maxPerSec: number): boolean {
    const now = Date.now();
    const b = this.controlBuckets.get(socketId);
    if (!b || now - b.windowStart >= 1000) {
      this.controlBuckets.set(socketId, { windowStart: now, count: 1 });
      return true;
    }
    if (b.count >= maxPerSec) return false;
    b.count += 1;
    return true;
  }
}

/** Nest/socket.io có thể truyền `{ payload: snap }` hoặc gửi thẳng object snapshot. */
function extractTelemetryPayload(body: unknown): Record<string, unknown> | null {
  if (body == null || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  if ('payload' in o && o.payload != null && typeof o.payload === 'object') {
    return o.payload as Record<string, unknown>;
  }
  return o;
}
