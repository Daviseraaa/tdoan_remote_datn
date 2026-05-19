import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/src/lib/auth';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export type TaskWsEvent = 'task:completed' | 'task:failed';

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
  onEvent: (event: TaskWsEvent) => void,
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

  socket.on('task:completed', () => onEvent('task:completed'));
  socket.on('task:failed', () => onEvent('task:failed'));
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
