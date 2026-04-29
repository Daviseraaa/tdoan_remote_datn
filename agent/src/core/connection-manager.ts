import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../logger';
import { AgentMetadata, WS_EVENTS } from '../types';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

export class ConnectionManager extends EventEmitter {
  private socket: Socket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;

  constructor() {
    super();
  }

  get currentState(): ConnectionState {
    return this.state;
  }

  get currentSocket(): Socket | null {
    return this.socket;
  }

  connect() {
    if (this.socket) {
      logger.warn('Already connected or connecting, skipping');
      return;
    }

    this.setState('connecting');
    const metadata: AgentMetadata = {
      os: `${config.platform} ${config.osRelease}`,
      hostname: config.hostname,
      platform: config.platform,
      arch: config.arch,
      cpuCount: config.cpuCount,
      totalMemory: config.totalMemory,
      agentVersion: config.agentVersion,
    };

    const url = new URL(config.serverUrl);
    const namespace = '/ws/agent';
    const base = `${url.protocol}//${url.host}`;

    logger.info({ base, namespace }, 'Connecting to server');

    this.socket = io(`${base}${namespace}`, {
      transports: ['websocket'],
      auth: { agentKey: config.agentKey, metadata },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.3,
      timeout: 15_000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
      logger.info({ id: this.socket?.id }, 'Connected to server');
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.setState('disconnected');
      logger.warn({ reason }, 'Disconnected from server');
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (err) => {
      this.reconnectAttempts++;
      logger.error(
        { attempt: this.reconnectAttempts, error: err.message },
        'Connection error',
      );
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      this.setState('connecting');
      logger.info({ attempt }, 'Reconnect attempt');
    });

    this.socket.on(WS_EVENTS.AGENT_STATUS, (data) => {
      logger.info({ data }, 'Agent status update');
      this.emit('status', data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setState('disconnected');
  }

  emit_(event: string, payload: unknown) {
    if (!this.socket || !this.socket.connected) {
      logger.warn({ event }, 'Cannot emit - socket not connected');
      return false;
    }
    this.socket.emit(event, payload);
    return true;
  }

  private setState(next: ConnectionState) {
    this.state = next;
    this.emit('state', next);
  }
}
