import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './auth';

const WS_URL = (import.meta.env.VITE_WS_URL as string) || 'http://localhost:3000';

let socket: Socket | null = null;

export function getClientSocket(): Socket {
  if (socket && socket.connected) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socket = io(`${WS_URL}/ws/client`, {
    transports: ['websocket'],
    auth: { token: getAccessToken() },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15_000,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
