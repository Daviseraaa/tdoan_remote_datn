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
import { Server, Socket } from 'socket.io';
import { TaskStatus } from '@prisma/client';
import { WS_EVENTS } from '../../common/constants/index';
import {
  HeartbeatPayload,
  TaskProgressPayload,
  TaskResultPayload,
  MAX_RESULT_SIZE,
} from '../../common/types/ws-protocol';
import { AgentsService } from './agents.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramActionNotifierService } from '../../common/logging/telegram-action-notifier.service';

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
    private prisma: PrismaService,
    private readonly actionNotifier: TelegramActionNotifierService,
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

      const metadata = client.handshake?.auth?.metadata as
        | Record<string, unknown>
        | undefined;
      await this.agentsService.markOnline(agentKey, client.id, metadata);

      this.logger.log(`Agent connected: ${agent.name} (${agent.id})`);
      await this.actionNotifier.notify('agent.connected', {
        agentId: agent.id,
        agentName: agent.name,
      });

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
      await this.actionNotifier.notify('agent.disconnected', {
        agentId: agent.id,
        agentName: agent.name,
      });
    }
  }

  @SubscribeMessage(WS_EVENTS.AGENT_HEARTBEAT)
  async handleHeartbeat(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody() _payload: HeartbeatPayload,
  ) {
    const agent = client.data?.agent;
    if (agent) {
      await this.agentsService.heartbeat(agent.agentKey);
    }
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

    this.logger.log(
      `Task result from ${agent.name}: ${data.taskId} => ${finalStatus}`,
    );
    await this.actionNotifier.notify('task.result', {
      taskId: data.taskId,
      status: finalStatus,
      exitCode: data.exitCode ?? -1,
      agentId: agent.id,
      agentName: agent.name,
    });

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

  private emitToClientRoom(room: string, event: string, data: unknown) {
    try {
      this.server.of('/ws/client').to(room).emit(event, data);
    } catch (err) {
      this.logger.warn(
        `Failed to emit cross-namespace: ${(err as Error).message}`,
      );
    }
  }

  emitToAgent(agentId: string, event: string, data: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, data);
  }
}
