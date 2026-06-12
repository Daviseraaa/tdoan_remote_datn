import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/src/lib/auth';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export type TaskWsEvent = 'task:running' | 'task:completed' | 'task:failed';

export type TaskWsPayload = {
  taskId: string;
  status: string;
  exitCode?: number;
};

export interface AgentTelemetryWsPayload {
  agentId: string;
  ip: string;
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  ramLabel: string;
  timestamp: number;
}

export interface AgentStatusWsPayload {
  agentId: string;
  status: string;
  timestamp: number;
}

export interface AgentRemoteReadyWsPayload {
  agentId: string;
  rustdeskId: string;
  rustdeskPassword: string;
  message?: string;
  active: boolean;
  timestamp: number;
}

const remoteReadyListeners = new Set<(payload: AgentRemoteReadyWsPayload) => void>();

export function onAgentRemoteReady(
  listener: (payload: AgentRemoteReadyWsPayload) => void,
): () => void {
  remoteReadyListeners.add(listener);
  return () => remoteReadyListeners.delete(listener);
}

function attachRemoteReadyHandler(sock: Socket) {
  sock.off('agent:remote:ready');
  sock.on('agent:remote:ready', (payload: AgentRemoteReadyWsPayload) => {
    remoteReadyListeners.forEach((listener) => listener(payload));
  });
}

export function connectWs(
  onEvent: (event: TaskWsEvent, payload: TaskWsPayload) => void,
  onAgentTelemetry?: (payload: AgentTelemetryWsPayload) => void,
  onAgentStatus?: (payload: AgentStatusWsPayload) => void,
): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  if (socket?.connected) {
    attachRemoteReadyHandler(socket);
    return socket;
  }

  const isLocal =
    WS_URL.includes('localhost') || WS_URL.includes('127.0.0.1');

  socket = io(`${WS_URL}/ws/client`, {
    auth: { token },
    query: { token },
    // Prod: chỉ WebSocket — tránh long-polling HTTP chiếm slot kết nối tới cùng host API.
    transports: isLocal ? ['websocket', 'polling'] : ['websocket'],
    upgrade: isLocal,
  });

  socket.on('task:running', (payload: TaskWsPayload) =>
    onEvent('task:running', payload),
  );
  socket.on('task:completed', (payload: TaskWsPayload) =>
    onEvent('task:completed', payload),
  );
  socket.on('task:failed', (payload: TaskWsPayload) => onEvent('task:failed', payload));
  if (onAgentTelemetry) {
    socket.on('agent:telemetry', (payload: AgentTelemetryWsPayload) => {
      onAgentTelemetry(payload);
    });
  }
  if (onAgentStatus) {
    socket.on('agent:status', (payload: AgentStatusWsPayload) => {
      onAgentStatus(payload);
    });
  }
  attachRemoteReadyHandler(socket);

  return socket;
}

export function disconnectWs(): void {
  socket?.disconnect();
  socket = null;
}
