import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Namespace, Server, Socket } from 'socket.io';
import { TaskStatus } from '@prisma/client';
import { WS_EVENTS } from '../../common/constants/index';
import {
  HeartbeatPayload,
  TaskProgressPayload,
  TaskResultPayload,
  MAX_RESULT_SIZE,
} from '../../common/types/ws-protocol';
import { AgentsService } from './agents.service';
import { AgentTelemetryStore } from './agent-telemetry.store';
import { PrismaService } from '../../prisma/prisma.service';
import {
  pickDisplayIp,
  resolveSocketPeerIp,
} from '../../common/utils/socket-ip';
import { notifyTaskCompleted } from '../../common/task-completion-registry';

interface AgentSocket extends Socket {
  data: {
    agent?: {
      id: string;
      agentKey: string;
      userId: string;
      name: string;
    };
  };
}

@WebSocketGateway({
  namespace: '/ws/agent',
  cors: { origin: '*' },
})
export class AgentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AgentsGateway.name);

  constructor(
    private agentsService: AgentsService,
    private telemetryStore: AgentTelemetryStore,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: AgentSocket) {
    try {
      const agentKey =
        client.handshake?.auth?.agentKey || client.handshake?.query?.agentKey;

      if (!agentKey || typeof agentKey !== 'string') {
        this.logger.warn(`Connection rejected: missing agentKey`);
        client.disconnect();
        return;
      }

      const agent = await this.prisma.agent.findUnique({
        where: { agentKey },
      });

      if (!agent) {
        this.logger.warn(`Connection rejected: invalid agentKey`);
        client.disconnect();
        return;
      }

      client.data = { agent };
      client.join(`agent:${agent.id}`);

      const handshakeMeta = client.handshake?.auth?.metadata as
        | Record<string, unknown>
        | undefined;
      const peerIp = resolveSocketPeerIp(client);
      const reportedIp =
        typeof handshakeMeta?.ip === 'string' ? handshakeMeta.ip : '';
      const displayIp = pickDisplayIp(peerIp, reportedIp);
      const metadata = {
        ...(handshakeMeta ?? {}),
        ...(displayIp ? { ip: displayIp } : {}),
      };
      await this.agentsService.markOnline(agentKey, client.id, metadata);

      this.logger.log(`Agent connected: ${agent.name} (${agent.id})`);

      client.emit(WS_EVENTS.AGENT_STATUS, {
        status: 'ONLINE',
        agentId: agent.id,
      });
    } catch (error) {
      this.logger.error('Connection error', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AgentSocket) {
    const agent = client.data?.agent;
    if (agent) {
      await this.agentsService.markOffline(agent.agentKey);
      this.logger.log(`Agent disconnected: ${agent.name} (${agent.id})`);
    }
  }

  @SubscribeMessage(WS_EVENTS.AGENT_HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody() payload: HeartbeatPayload,
  ) {
    const agent = client.data?.agent;
    if (!agent) {
      return { event: WS_EVENTS.AGENT_HEARTBEAT, data: { ok: false } };
    }

    const cpu =
      typeof payload.cpuPercent === 'number'
        ? payload.cpuPercent
        : typeof payload.cpuUsage === 'number'
          ? payload.cpuUsage
          : 0;
    const ramUsed =
      typeof payload.ramUsedBytes === 'number' ? payload.ramUsedBytes : 0;
    const ramTotal =
      typeof payload.ramTotalBytes === 'number' ? payload.ramTotalBytes : 0;
    const ramLabel =
      typeof payload.ramLabel === 'string' && payload.ramLabel
        ? payload.ramLabel
        : ramTotal > 0
          ? `${(ramUsed / 1024 ** 3).toFixed(1)}/${(ramTotal / 1024 ** 3).toFixed(1)} GB`
          : '—';
    const reportedIp = typeof payload.ip === 'string' ? payload.ip : '';
    const ip = pickDisplayIp(resolveSocketPeerIp(client), reportedIp);
    const timestamp =
      typeof payload.timestamp === 'number' ? payload.timestamp : Date.now();

    const telemetry = {
      agentId: agent.id,
      ip,
      cpuPercent: Math.min(100, Math.max(0, cpu)),
      ramUsedBytes: ramUsed,
      ramTotalBytes: ramTotal,
      ramLabel,
      timestamp,
    };

    this.telemetryStore.set(agent.id, telemetry);
    this.emitToClientRoom(`user:${agent.userId}`, WS_EVENTS.AGENT_TELEMETRY, telemetry);
    this.emitToClientRoom('admins', WS_EVENTS.AGENT_TELEMETRY, telemetry);

    await this.agentsService.heartbeat(agent.agentKey, {
      ip,
      cpuPercent: Math.min(100, Math.max(0, cpu)),
      ramUsedBytes: ramUsed,
      ramTotalBytes: ramTotal,
      ramLabel,
      timestamp,
    });
    return { event: WS_EVENTS.AGENT_HEARTBEAT, data: { ok: true } };
  }

  @SubscribeMessage(WS_EVENTS.TASK_RESULT)
  async handleTaskResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody() data: TaskResultPayload,
  ) {
    const agent = client.data?.agent;
    if (!agent) {
      return { event: WS_EVENTS.TASK_RESULT, data: { received: false } };
    }

    if (!data || typeof data.taskId !== 'string') {
      this.logger.warn(`Invalid task:result payload from ${agent.name}`);
      return { event: WS_EVENTS.TASK_RESULT, data: { received: false } };
    }

    const task = await this.prisma.task.findFirst({
      where: { id: data.taskId, agentId: agent.id },
    });

    if (!task) {
      this.logger.warn(
        `Task ${data.taskId} not found or not owned by agent ${agent.id}`,
      );
      return { event: WS_EVENTS.TASK_RESULT, data: { received: false } };
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(task.status)) {
      this.logger.log(`Task ${data.taskId} already in terminal state`);
      return { event: WS_EVENTS.TASK_RESULT, data: { received: true } };
    }

    const truncatedResult =
      data.result && data.result.length > MAX_RESULT_SIZE
        ? data.result.slice(0, MAX_RESULT_SIZE) + '\n...[TRUNCATED]'
        : data.result || '';

    const finalStatus =
      data.status === 'COMPLETED' ? TaskStatus.COMPLETED : TaskStatus.FAILED;

    await this.prisma.task.update({
      where: { id: data.taskId },
      data: {
        status: finalStatus,
        result: truncatedResult,
        exitCode: data.exitCode ?? -1,
        completedAt: new Date(),
      },
    });

    await this.prisma.taskLog.create({
      data: {
        taskId: data.taskId,
        level: finalStatus === TaskStatus.COMPLETED ? 'INFO' : 'ERROR',
        message: `Task ${finalStatus.toLowerCase()} (exit code ${data.exitCode ?? -1})`,
      },
    });

    notifyTaskCompleted(data.taskId, {
      status: finalStatus,
      exitCode: data.exitCode ?? -1,
      result: truncatedResult,
      error:
        finalStatus === TaskStatus.FAILED ? truncatedResult : undefined,
    });

    this.logger.log(
      `Task result from ${agent.name}: ${data.taskId} => ${finalStatus}`,
    );

    const eventName =
      finalStatus === TaskStatus.COMPLETED
        ? WS_EVENTS.TASK_COMPLETED
        : WS_EVENTS.TASK_FAILED;

    const payload = {
      taskId: data.taskId,
      status: finalStatus,
      exitCode: data.exitCode,
      result: truncatedResult,
    };
    this.emitToClientRoom(`user:${agent.userId}`, eventName, payload);
    this.emitToClientRoom('admins', eventName, payload);

    return { event: WS_EVENTS.TASK_RESULT, data: { received: true } };
  }

  @SubscribeMessage(WS_EVENTS.TASK_PROGRESS)
  async handleTaskProgress(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody() data: TaskProgressPayload,
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.taskId) return;

    await this.prisma.taskLog.create({
      data: {
        taskId: data.taskId,
        level: 'INFO',
        message: data.message || 'progress',
      },
    });

    this.emitToClientRoom(
      `user:${agent.userId}`,
      WS_EVENTS.TASK_PROGRESS,
      data,
    );
  }

  /** Gateway `/ws/agent`: `server` là Namespace — emit client qua `namespace.server.of(...)`. */
  private emitToClientRoom(room: string, event: string, data: unknown) {
    try {
      const root = this.resolveRootServer();
      if (!root) {
        this.logger.warn('Socket.IO root server unavailable for client emit');
        return;
      }
      root.of('/ws/client').to(room).emit(event, data);
    } catch (err) {
      this.logger.warn(
        `Failed to emit cross-namespace: ${(err as Error).message}`,
      );
    }
  }

  private resolveRootServer(): Server | null {
    const srv = this.server as Server & Namespace;
    if (typeof srv.of === 'function') {
      return srv;
    }
    const parent = srv.server;
    if (parent && typeof parent.of === 'function') {
      return parent;
    }
    return null;
  }

  emitToAgent(agentId: string, event: string, data: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, data);
  }
}
