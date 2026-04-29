import { config } from '../config';
import { ConnectionManager } from '../core/connection-manager';
import { logger } from '../logger';
import { WS_EVENTS } from '../types';
import { applyRemoteControl } from './input-controller';
import { RemotePeer, RemoteSessionPayload } from './remote-peer';

export class RemoteHost {
  private peer: RemotePeer | null = null;
  private lastControlVia: 'dc' | 'socket' | null = null;

  private readonly onSession = (payload: RemoteSessionPayload) => {
    if (!payload?.sessionId || !payload.agentSignalingToken) {
      logger.warn({ payload }, 'Invalid remote session payload');
      return;
    }
    void this.peer?.dispose();
    this.peer = new RemotePeer(payload);
    this.lastControlVia = null;
    void this.peer.start();
  };

  private readonly onEnd = (payload: { sessionId?: string }) => {
    if (!this.peer) return;
    if (payload?.sessionId && payload.sessionId !== this.peer.sessionId) return;
    void this.peer.dispose();
    this.peer = null;
    this.lastControlVia = null;
  };

  private readonly onControl = (body: Record<string, unknown>) => {
    if (!this.peer) return;
    const type = String(body?.type || '');
    if (type === 'SET_QUALITY_PROFILE' || type === 'SET_CAPTURE_REGION') {
      this.peer.handleControlPayload(body);
      return;
    }
    if (config.remote.dataChannelEnabled && this.peer.isControlChannelOpen()) {
      if (this.lastControlVia !== 'dc') {
        logger.info({ sessionId: this.peer.sessionId }, 'control via data channel active; socket is fallback');
        this.lastControlVia = 'dc';
      }
      return;
    }
    if (this.lastControlVia !== 'socket') {
      logger.info({ sessionId: this.peer.sessionId }, 'control via socket fallback');
      this.lastControlVia = 'socket';
    }
    void applyRemoteControl(body);
  };

  constructor(private readonly conn: ConnectionManager) {
    conn.on('connected', () => this.register());
    conn.on('disconnected', () => {
      void this.peer?.dispose();
      this.peer = null;
      this.lastControlVia = null;
    });
  }

  private register() {
    const s = this.conn.currentSocket;
    if (!s) return;
    s.off(WS_EVENTS.REMOTE_SESSION, this.onSession);
    s.off(WS_EVENTS.REMOTE_END, this.onEnd);
    s.off(WS_EVENTS.REMOTE_CONTROL, this.onControl);
    s.on(WS_EVENTS.REMOTE_SESSION, this.onSession);
    s.on(WS_EVENTS.REMOTE_END, this.onEnd);
    s.on(WS_EVENTS.REMOTE_CONTROL, this.onControl);
  }
}
