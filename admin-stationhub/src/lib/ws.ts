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

export function connectWs(
  onEvent: (event: TaskWsEvent, payload: TaskWsPayload) => void,
  onAgentTelemetry?: (payload: AgentTelemetryWsPayload) => void,
): Socket | null {
  const token = getAccessToken();
  if (!token) return null;

  if (socket?.connected) {
    return socket;
  }

  socket = io(`${WS_URL}/ws/client`, {
    auth: { token },
    query: { token },
    transports: ['websocket', 'polling'],
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

  return socket;
}

export function disconnectWs(): void {
  socket?.disconnect();
  socket = null;
}
