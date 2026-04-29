import * as os from 'os';
import { config } from '../config';
import { logger } from '../logger';
import { ConnectionManager } from './connection-manager';
import { HeartbeatPayload, WS_EVENTS } from '../types';

export class HeartbeatService {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly connection: ConnectionManager) {}

  start() {
    this.stop();
    this.sendOnce();
    this.timer = setInterval(() => this.sendOnce(), config.heartbeatIntervalMs);
    logger.info(
      { intervalMs: config.heartbeatIntervalMs },
      'Heartbeat service started',
    );
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private sendOnce() {
    const payload: HeartbeatPayload = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().rss / os.totalmem(),
    };
    this.connection.emit_(WS_EVENTS.AGENT_HEARTBEAT, payload);
  }
}
