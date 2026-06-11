import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AgentStatus, TaskStatus } from '@prisma/client';
import { Namespace, Server, Socket } from 'socket.io';
import { WS_EVENTS } from '../../common/constants/index';
import {
  HeartbeatPayload,
  TaskProgressPayload,
  TaskResultPayload,
  MAX_RESULT_SIZE,
} from '../../common/types/ws-protocol';
import { AgentsService } from './agents.service';
import { AgentTelemetryStore } from './agent-telemetry.store';
import { SubscriptionService } from '../billing/subscription.service';
import { ChromeScriptsService } from '../chrome-scripts/chrome-scripts.service';
import { DesktopRecordingsService } from '../desktop-recordings/desktop-recordings.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  pickDisplayIp,
  resolveSocketPeerIp,
} from '../../common/utils/socket-ip';
import { notifyTaskCompleted } from '../../common/task-completion-registry';
import {
  failChromeProfilesWaiter,
  notifyChromeProfilesResult,
  registerChromeProfilesWaiter,
  type ChromeProfileEntry,
} from '../../common/chrome-profiles-registry';
import {
  failChromeScriptsWaiter,
  notifyChromeScriptsResult,
  registerChromeScriptsWaiter,
  type AgentChromeScriptEntry,
} from '../../common/chrome-scripts-registry';
import {
  failDesktopRecordingsWaiter,
  notifyDesktopRecordingsResult,
  registerDesktopRecordingsWaiter,
  type AgentDesktopRecordingEntry,
} from '../../common/desktop-recordings-registry';
import {
  failAgentFilesListWaiter,
  failAgentFilesReadWaiter,
  failAgentFilesWriteWaiter,
  normalizeAgentFileEntry,
  normalizeAgentFileReadPayload,
  normalizeAgentFileWritePayload,
  notifyAgentFilesListResult,
  notifyAgentFilesReadResult,
  notifyAgentFilesWriteResult,
  registerAgentFilesListWaiter,
  registerAgentFilesReadWaiter,
  registerAgentFilesWriteWaiter,
  type AgentFileEntry,
  type AgentFileReadPayload,
  type AgentFileWritePayload,
  type AgentFileWriteRequest,
  type AgentFilesListResult,
} from '../../common/agent-files-registry';
import {
  failAgentRemoteStartWaiter,
  failAgentRemoteStopWaiter,
  notifyAgentRemoteStartResult,
  notifyAgentRemoteStopResult,
  registerAgentRemoteStartWaiter,
  registerAgentRemoteStopWaiter,
} from '../../common/agent-remote-registry';

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
    private chromeScriptsService: ChromeScriptsService,
    private desktopRecordingsService: DesktopRecordingsService,
    private subscriptionService: SubscriptionService,
  ) {}

  async handleConnection(client: AgentSocket) {
    try {
      const authKey = client.handshake?.auth?.agentKey;
      const queryKey = client.handshake?.query?.agentKey;
      if (queryKey && !authKey) {
        this.logger.warn('Connection rejected: agentKey in query string is not allowed');
        client.disconnect();
        return;
      }

      const agentKey =
        typeof authKey === 'string' ? authKey.trim() : '';

      if (!agentKey) {
        this.logger.warn(`Connection rejected: missing agentKey`);
        client.disconnect();
        return;
      }

      const agent = await this.prisma.agent.findUnique({
        where: { agentKey },
        include: {
          user: {
            select: {
              id: true,
              role: true,
              subscriptionStatus: true,
              subscriptionExpiresAt: true,
            },
          },
        },
      });

      if (!agent) {
        this.logger.warn(`Connection rejected: invalid agentKey`);
        client.disconnect();
        return;
      }

      if (!this.subscriptionService.isSubscriptionActive(agent.user)) {
        client.emit(WS_EVENTS.AGENT_SUBSCRIPTION_EXPIRED, {
          reason: 'SUBSCRIPTION_EXPIRED',
          message: 'Gói đăng ký đã hết hạn. Vui lòng gia hạn trên trang quản trị.',
        });
        this.logger.warn(
          `Connection rejected: subscription expired for user ${agent.user.id}`,
        );
        client.disconnect();
        return;
      }

      try {
        await this.subscriptionService.assertAgentConnectAllowed(
          agent.userId,
          agent.id,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Agent không được phép kết nối';
        client.emit(WS_EVENTS.AGENT_SESSION_REVOKED, {
          reason: 'PLAN_AGENT_LIMIT',
          message,
        });
        this.logger.warn(
          `Connection rejected: plan agent limit for user ${agent.userId}`,
        );
        client.disconnect();
        return;
      }

      await this.disconnectAgentById(agent.id, 'SUPERSEDED');

      client.data = { agent: { id: agent.id, agentKey: agent.agentKey, userId: agent.userId, name: agent.name } };
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
      this.emitAgentStatusToClients(agent.userId, agent.id, AgentStatus.ONLINE);
    } catch (error) {
      this.logger.error('Connection error', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AgentSocket) {
    const agent = client.data?.agent;
    if (!agent) return;

    const result = await this.agentsService.markOffline(
      agent.agentKey,
      client.id,
    );
    if (result.changed) {
      this.logger.log(`Agent disconnected: ${agent.name} (${agent.id})`);
      this.emitAgentStatusToClients(
        agent.userId,
        agent.id,
        AgentStatus.OFFLINE,
      );
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

    const owner = await this.prisma.user.findUnique({
      where: { id: agent.userId },
      select: {
        id: true,
        role: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });
    if (!owner || !this.subscriptionService.isSubscriptionActive(owner)) {
      client.emit(WS_EVENTS.AGENT_SUBSCRIPTION_EXPIRED, {
        reason: 'SUBSCRIPTION_EXPIRED',
      });
      client.disconnect();
      return { event: WS_EVENTS.AGENT_HEARTBEAT, data: { ok: false } };
    }

    const agentRow = await this.prisma.agent.findUnique({
      where: { id: agent.id },
      select: { agentKey: true },
    });
    if (!agentRow || agentRow.agentKey !== agent.agentKey) {
      client.emit(WS_EVENTS.AGENT_SESSION_REVOKED, {
        reason: 'KEY_REVOKED',
        message: 'Agent Key đã được thay đổi. Cập nhật cấu hình và kết nối lại.',
      });
      client.disconnect();
      return { event: WS_EVENTS.AGENT_HEARTBEAT, data: { ok: false } };
    }

    try {
      await this.subscriptionService.assertAgentConnectAllowed(
        agent.userId,
        agent.id,
      );
    } catch {
      client.emit(WS_EVENTS.AGENT_SESSION_REVOKED, {
        reason: 'PLAN_AGENT_LIMIT',
      });
      client.disconnect();
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

    const prev = await this.prisma.agent.findUnique({
      where: { id: agent.id },
      select: { status: true },
    });

    await this.agentsService.heartbeat(agent.agentKey, {
      ip,
      cpuPercent: Math.min(100, Math.max(0, cpu)),
      ramUsedBytes: ramUsed,
      ramTotalBytes: ramTotal,
      ramLabel,
      timestamp,
    });

    if (
      prev?.status === AgentStatus.OFFLINE &&
      this.agentsService.isOnline(agent.agentKey)
    ) {
      this.emitAgentStatusToClients(
        agent.userId,
        agent.id,
        AgentStatus.ONLINE,
      );
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

    let finalStatus: TaskStatus;
    if (data.status === 'CANCELLED') {
      finalStatus = TaskStatus.CANCELLED;
    } else if (data.status === 'COMPLETED') {
      finalStatus = TaskStatus.COMPLETED;
    } else {
      finalStatus = TaskStatus.FAILED;
    }

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
        level:
          finalStatus === TaskStatus.COMPLETED
            ? 'INFO'
            : finalStatus === TaskStatus.CANCELLED
              ? 'WARN'
              : 'ERROR',
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
        : finalStatus === TaskStatus.CANCELLED
          ? WS_EVENTS.TASK_FAILED
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

  @SubscribeMessage(WS_EVENTS.CHROME_PROFILES_RESULT)
  handleChromeProfilesResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      profiles?: ChromeProfileEntry[];
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failChromeProfilesWaiter(
        data.requestId,
        data.error ?? 'Agent không liệt kê được Chrome profile',
      );
      return;
    }

    const profiles = Array.isArray(data.profiles) ? data.profiles : [];
    notifyChromeProfilesResult(data.requestId, profiles);
    this.logger.log(
      `Chrome profiles from ${agent.name}: ${profiles.length} profile(s)`,
    );
  }

  async syncChromeProfiles(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    this.assertAgentReachable(
      agent,
      'Agent đang offline — không thể lấy Chrome profile',
    );

    const requestId = randomUUID();
    const wait = registerChromeProfilesWaiter(requestId, 20_000);
    this.emitToAgent(agentId, WS_EVENTS.CHROME_PROFILES_SYNC, { requestId });

    let profiles: ChromeProfileEntry[];
    try {
      profiles = await wait;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      throw new BadRequestException(msg);
    }

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { chromeProfiles: profiles as object },
    });

    return { profiles, count: profiles.length };
  }

  @SubscribeMessage(WS_EVENTS.CHROME_SCRIPTS_RESULT)
  handleChromeScriptsResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      scripts?: unknown[];
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failChromeScriptsWaiter(
        data.requestId,
        data.error ?? 'Agent không liệt kê được Chrome script',
      );
      return;
    }

    const raw = Array.isArray(data.scripts) ? data.scripts : [];
    const scripts: AgentChromeScriptEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const steps = Array.isArray(row.steps) ? row.steps : [];
      if (!id || !name || steps.length === 0) continue;
      scripts.push({
        id,
        name,
        startUrl:
          typeof row.startUrl === 'string'
            ? row.startUrl
            : row.startUrl === null
              ? null
              : undefined,
        steps,
        savedPath:
          typeof row.savedPath === 'string' ? row.savedPath : undefined,
      });
    }

    notifyChromeScriptsResult(data.requestId, scripts);
    this.logger.log(
      `Chrome scripts from ${agent.name}: ${scripts.length} script(s)`,
    );
  }

  async syncChromeScripts(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    this.assertAgentReachable(
      agent,
      'Agent đang offline — không thể đồng bộ Chrome script',
    );

    const requestId = randomUUID();
    const wait = registerChromeScriptsWaiter(requestId, 30_000);
    this.emitToAgent(agentId, WS_EVENTS.CHROME_SCRIPTS_SYNC, { requestId });

    let scripts: AgentChromeScriptEntry[];
    try {
      scripts = await wait;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      throw new BadRequestException(msg);
    }

    const summary = await this.chromeScriptsService.syncFromAgent(
      userId,
      agentId,
      scripts,
    );

    return { ...summary, agentId, agentName: agent.name };
  }

  @SubscribeMessage(WS_EVENTS.DESKTOP_RECORDINGS_RESULT)
  handleDesktopRecordingsResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      recordings?: unknown[];
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failDesktopRecordingsWaiter(
        data.requestId,
        data.error ?? 'Agent không liệt kê được desktop recording',
      );
      return;
    }

    const raw = Array.isArray(data.recordings) ? data.recordings : [];
    const recordings: AgentDesktopRecordingEntry[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id.trim() : '';
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const steps = Array.isArray(row.steps) ? row.steps : [];
      if (!id || !name || steps.length === 0) continue;
      recordings.push({
        id,
        name,
        steps,
        savedPath:
          typeof row.savedPath === 'string' ? row.savedPath : undefined,
      });
    }

    notifyDesktopRecordingsResult(data.requestId, recordings);
    this.logger.log(
      `Desktop recordings from ${agent.name}: ${recordings.length} recording(s)`,
    );
  }

  async syncDesktopRecordings(agentId: string, userId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    this.assertAgentReachable(
      agent,
      'Agent đang offline — không thể đồng bộ desktop recording',
    );

    const requestId = randomUUID();
    const wait = registerDesktopRecordingsWaiter(requestId, 30_000);
    this.emitToAgent(agentId, WS_EVENTS.DESKTOP_RECORDINGS_SYNC, { requestId });

    let recordings: AgentDesktopRecordingEntry[];
    try {
      recordings = await wait;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed';
      throw new BadRequestException(msg);
    }

    const summary = await this.desktopRecordingsService.syncFromAgent(
      userId,
      agentId,
      recordings,
    );

    return { ...summary, agentId, agentName: agent.name };
  }

  @SubscribeMessage(WS_EVENTS.FILES_LIST_RESULT)
  handleAgentFilesListResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      path?: string;
      root?: string;
      entries?: unknown[];
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failAgentFilesListWaiter(
        data.requestId,
        data.error ?? 'Agent không liệt kê được thư mục',
      );
      return;
    }

    const entries: AgentFileEntry[] = [];
    for (const item of Array.isArray(data.entries) ? data.entries : []) {
      const row = normalizeAgentFileEntry(item);
      if (row) entries.push(row);
    }

    notifyAgentFilesListResult(data.requestId, {
      path: typeof data.path === 'string' ? data.path : '',
      root: typeof data.root === 'string' ? data.root : '',
      entries,
    });
    this.logger.log(
      `Agent files list from ${agent.name}: ${entries.length} item(s)`,
    );
  }

  @SubscribeMessage(WS_EVENTS.FILES_READ_RESULT)
  handleAgentFilesReadResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      file?: unknown;
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failAgentFilesReadWaiter(
        data.requestId,
        data.error ?? 'Agent không đọc được file',
      );
      return;
    }

    const file = normalizeAgentFileReadPayload(data.file);
    if (!file) {
      failAgentFilesReadWaiter(data.requestId, 'Phản hồi file không hợp lệ');
      return;
    }
    notifyAgentFilesReadResult(data.requestId, file);
  }

  @SubscribeMessage(WS_EVENTS.FILES_WRITE_RESULT)
  handleAgentFilesWriteResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      file?: unknown;
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failAgentFilesWriteWaiter(
        data.requestId,
        data.error ?? 'Agent không ghi được file',
      );
      return;
    }

    const file = normalizeAgentFileWritePayload(data.file);
    if (!file) {
      failAgentFilesWriteWaiter(data.requestId, 'Phản hồi ghi file không hợp lệ');
      return;
    }
    notifyAgentFilesWriteResult(data.requestId, file);
    this.logger.log(
      `Agent files write from ${agent.name}: ${file.path} (${file.size} bytes, written=${file.written})`,
    );
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_START_RESULT)
  handleAgentRemoteStartResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      provider?: string;
      message?: string;
      error?: string;
      rustdeskId?: string;
      rustdeskPassword?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failAgentRemoteStartWaiter(
        data.requestId,
        data.error ?? 'Agent không khởi động được remote',
      );
      return;
    }

    const rustdeskId =
      typeof data.rustdeskId === 'string' && data.rustdeskId.trim()
        ? data.rustdeskId.trim()
        : undefined;
    const rustdeskPassword =
      typeof data.rustdeskPassword === 'string' && data.rustdeskPassword
        ? data.rustdeskPassword
        : undefined;

    notifyAgentRemoteStartResult(data.requestId, {
      provider:
        typeof data.provider === 'string' && data.provider.trim()
          ? data.provider.trim()
          : 'rustdesk',
      message: typeof data.message === 'string' ? data.message : undefined,
      rustdeskId,
      rustdeskPassword,
    });

    if (rustdeskId && rustdeskPassword) {
      this.emitAgentRemoteReadyToClients(agent.userId, {
        agentId: agent.id,
        rustdeskId,
        rustdeskPassword,
        message: typeof data.message === 'string' ? data.message : undefined,
        active: true,
      });
    }

    this.logger.log(`Agent remote start OK from ${agent.name}`);
  }

  @SubscribeMessage(WS_EVENTS.REMOTE_STOP_RESULT)
  handleAgentRemoteStopResult(
    @ConnectedSocket() client: AgentSocket,
    @MessageBody()
    data: {
      requestId?: string;
      ok?: boolean;
      provider?: string;
      message?: string;
      error?: string;
    },
  ) {
    const agent = client.data?.agent;
    if (!agent || !data?.requestId) return;

    if (!data.ok) {
      failAgentRemoteStopWaiter(
        data.requestId,
        data.error ?? 'Agent không dừng được remote',
      );
      return;
    }

    notifyAgentRemoteStopResult(data.requestId, {
      provider:
        typeof data.provider === 'string' && data.provider.trim()
          ? data.provider.trim()
          : 'rustdesk',
      message: typeof data.message === 'string' ? data.message : undefined,
    });
    this.logger.log(`Agent remote stop OK from ${agent.name}`);
  }

  private assertAgentReachable(
    agent: { agentKey: string; status: AgentStatus },
    message: string,
  ) {
    if (
      !this.agentsService.isOnline(agent.agentKey) &&
      agent.status !== AgentStatus.ONLINE &&
      agent.status !== AgentStatus.BUSY
    ) {
      throw new BadRequestException(message);
    }
  }

  private async assertAgentOnlineForRpc(agentId: string, userId: string | null) {
    const agent = await this.prisma.agent.findFirst({
      where: userId ? { id: agentId, userId } : { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    this.assertAgentReachable(agent, 'Agent đang offline — không thể gọi RPC');
    return agent;
  }

  async listAgentFiles(agentId: string, userId: string | null, path = '') {
    const agent = await this.assertAgentOnlineForRpc(agentId, userId);
    const requestId = randomUUID();
    const wait = registerAgentFilesListWaiter(requestId, 25_000);
    this.emitToAgent(agentId, WS_EVENTS.FILES_LIST_SYNC, { requestId, path });

    try {
      const result = await wait;
      return { agentId, agentName: agent.name, ...result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'List files failed';
      throw new BadRequestException(msg);
    }
  }

  emitTaskCancel(agentId: string, taskId: string) {
    this.emitToAgent(agentId, WS_EVENTS.TASK_CANCEL, { taskId });
  }

  async writeAgentFile(
    agentId: string,
    userId: string | null,
    body: AgentFileWriteRequest,
  ): Promise<AgentFileWritePayload & { agentId: string; agentName: string }> {
    const agent = await this.assertAgentOnlineForRpc(agentId, userId);
    const path = body.path?.trim();
    if (!path) {
      throw new BadRequestException('path is required');
    }
    if (!body.content) {
      throw new BadRequestException('content is required');
    }
    const requestId = randomUUID();
    const wait = registerAgentFilesWriteWaiter(requestId, 120_000);
    this.emitToAgent(agentId, WS_EVENTS.FILES_WRITE_SYNC, {
      requestId,
      path,
      content: body.content,
      encoding: body.encoding ?? 'utf-8',
      ...(body.uploadId ? { uploadId: body.uploadId } : {}),
      ...(body.chunkIndex != null ? { chunkIndex: body.chunkIndex } : {}),
      ...(body.totalChunks != null ? { totalChunks: body.totalChunks } : {}),
    });

    try {
      const file = await wait;
      return { agentId, agentName: agent.name, ...file };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Write file failed';
      throw new BadRequestException(msg);
    }
  }

  async readAgentFile(
    agentId: string,
    userId: string | null,
    path: string,
    maxBytes?: number,
  ): Promise<AgentFileReadPayload & { agentId: string; agentName: string }> {
    const agent = await this.assertAgentOnlineForRpc(agentId, userId);
    const requestId = randomUUID();
    const wait = registerAgentFilesReadWaiter(requestId, 60_000);
    this.emitToAgent(agentId, WS_EVENTS.FILES_READ_SYNC, {
      requestId,
      path,
      ...(maxBytes != null ? { maxBytes } : {}),
    });

    try {
      const file = await wait;
      return { agentId, agentName: agent.name, ...file };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Read file failed';
      throw new BadRequestException(msg);
    }
  }

  async startAgentRemote(agentId: string, userId: string | null) {
    const agent = await this.assertAgentOnlineForRpc(agentId, userId);
    const meta =
      agent.metadata && typeof agent.metadata === 'object' && !Array.isArray(agent.metadata)
        ? (agent.metadata as Record<string, unknown>)
        : {};
    const requestId = randomUUID();
    const wait = registerAgentRemoteStartWaiter(requestId, 120_000);
    this.emitToAgent(agentId, WS_EVENTS.REMOTE_START_SYNC, {
      requestId,
      provider: 'rustdesk',
    });

    try {
      const started = await wait;
      const now = new Date().toISOString();
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: {
          metadata: {
            ...meta,
            lastRemoteStartAt: now,
            rustdeskRemoteActive: true,
          } as object,
        },
      });
      return {
        ok: true,
        active: true,
        agentId,
        agentName: agent.name,
        provider: started.provider,
        rustdeskId: started.rustdeskId,
        rustdeskPassword: started.rustdeskPassword,
        message:
          started.message ??
          'RustDesk đã mở trên máy agent. Đang kết nối từ máy bạn…',
        startedAt: now,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Start remote failed';
      throw new BadRequestException(msg);
    }
  }

  async stopAgentRemote(agentId: string, userId: string | null) {
    const agent = await this.assertAgentOnlineForRpc(agentId, userId);
    const meta =
      agent.metadata && typeof agent.metadata === 'object' && !Array.isArray(agent.metadata)
        ? (agent.metadata as Record<string, unknown>)
        : {};
    const requestId = randomUUID();
    const wait = registerAgentRemoteStopWaiter(requestId, 90_000);
    this.emitToAgent(agentId, WS_EVENTS.REMOTE_STOP_SYNC, {
      requestId,
      provider: 'rustdesk',
    });

    try {
      const stopped = await wait;
      const now = new Date().toISOString();
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: {
          metadata: {
            ...meta,
            rustdeskRemoteActive: false,
            lastRemoteStopAt: now,
          } as object,
        },
      });
      return {
        ok: true,
        active: false,
        agentId,
        agentName: agent.name,
        provider: stopped.provider,
        message: stopped.message ?? 'Đã đóng ứng dụng RustDesk.',
        stoppedAt: now,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stop remote failed';
      throw new BadRequestException(msg);
    }
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

  /** RustDesk credentials từ agent — push realtime tới admin UI (không đọc metadata DB). */
  private emitAgentRemoteReadyToClients(
    userId: string,
    payload: {
      agentId: string;
      rustdeskId: string;
      rustdeskPassword: string;
      message?: string;
      active: boolean;
    },
  ) {
    const body = { ...payload, timestamp: Date.now() };
    this.emitToClientRoom(`user:${userId}`, WS_EVENTS.REMOTE_READY, body);
    this.emitToClientRoom('admins', WS_EVENTS.REMOTE_READY, body);
  }

  /** Đồng bộ ONLINE/OFFLINE tới web client (không chờ poll REST). */
  private emitAgentStatusToClients(
    userId: string,
    agentId: string,
    status: AgentStatus,
  ) {
    const payload = {
      agentId,
      status,
      timestamp: Date.now(),
    };
    this.emitToClientRoom(`user:${userId}`, WS_EVENTS.AGENT_STATUS, payload);
    this.emitToClientRoom('admins', WS_EVENTS.AGENT_STATUS, payload);
  }

  /** Push task status tới admin UI (tránh chờ poll). */
  emitTaskStatusToUser(userId: string, taskId: string, status: TaskStatus) {
    const event =
      status === TaskStatus.RUNNING
        ? WS_EVENTS.TASK_RUNNING
        : status === TaskStatus.COMPLETED
          ? WS_EVENTS.TASK_COMPLETED
          : status === TaskStatus.FAILED || status === TaskStatus.TIMEOUT
            ? WS_EVENTS.TASK_FAILED
            : WS_EVENTS.TASK_PROGRESS;
    const payload = { taskId, status };
    this.emitToClientRoom(`user:${userId}`, event, payload);
    this.emitToClientRoom('admins', event, payload);
  }

  emitToAgent(agentId: string, event: string, data: unknown) {
    this.server.to(`agent:${agentId}`).emit(event, data);
  }

  /** Ngắt mọi socket trong room agent (regenerate key, vượt gói, thay phiên mới). */
  async disconnectAgentById(
    agentId: string,
    reason: string,
    exceptSocketId?: string,
  ): Promise<void> {
    const sockets = await this.server.in(`agent:${agentId}`).fetchSockets();
    for (const socket of sockets) {
      if (exceptSocketId && socket.id === exceptSocketId) continue;
      socket.emit(WS_EVENTS.AGENT_SESSION_REVOKED, { reason });
      socket.disconnect(true);
    }
  }
}
