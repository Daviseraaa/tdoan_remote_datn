import {
  DataChannel,
  DescriptionType,
  Direction,
  PeerConnection,
  RtcConfig,
  Video,
} from 'node-datachannel';
import { logger } from '../../logger';
import { FfmpegSession } from '../native-encoder/ffmpeg-session';
import { H264TrackFeeder } from './h264-track';

type IceServer = { urls: string[]; username?: string; credential?: string };
type OfferAnswer = { type: string; sdp: string };
type IceCandidatePayload = { candidate?: string; sdpMid?: string };

interface NdcCallbacks {
  onLocalDescription: (desc: OfferAnswer) => void;
  onLocalCandidate: (ice: IceCandidatePayload) => void;
  onControlMessage: (raw: unknown) => void;
  onStateChange?: (state: string) => void;
}

interface NdcConfig {
  sessionId: string;
  iceServers: IceServer[];
  ffmpegPath: string;
  preferredEncoder: 'h264_nvenc' | 'h264_amf' | 'h264_qsv' | 'libx264';
  bitrateKbps: number;
  fps: number;
  keyint: number;
  preset: string;
  qualityProfile: 'low-latency' | 'balanced' | 'high-quality';
}

export class NdcPeerSession {
  private pc: PeerConnection;
  private dc: DataChannel | null = null;
  private ffmpeg: FfmpegSession | null = null;
  private feeder: H264TrackFeeder | null = null;
  private opened = false;
  private bytesSentAtStart = 0;
  private lastRestartAt = 0;

  constructor(
    private cfg: NdcConfig,
    private readonly callbacks: NdcCallbacks,
  ) {
    this.pc = new PeerConnection(`agent-ndc-${cfg.sessionId}`, {
      iceServers: normalizeIceServers(cfg.iceServers),
      forceMediaTransport: true,
    } as RtcConfig);
    this.wireCoreCallbacks();
    this.attachVideoTrack();
  }

  isControlOpen(): boolean {
    return !!this.dc && this.dc.isOpen();
  }

  stats() {
    return {
      rttMs: this.pc.rtt(),
      bytesSent: this.pc.bytesSent(),
      bytesReceived: this.pc.bytesReceived(),
      connected: this.opened,
      restartCount: this.ffmpeg?.stats.restartCount ?? 0,
    };
  }

  setTarget(next: { fps: number; bitrateKbps: number }) {
    const now = Date.now();
    if (now - this.lastRestartAt < 4000) return;
    if (!this.ffmpeg) return;
    const deltaFps = Math.abs(next.fps - this.cfg.fps);
    const deltaBitrate = Math.abs(next.bitrateKbps - this.cfg.bitrateKbps);
    if (deltaFps < 2 && deltaBitrate < 300) return;
    this.cfg.fps = next.fps;
    this.cfg.bitrateKbps = next.bitrateKbps;
    this.lastRestartAt = now;
    this.ffmpeg.stop();
    this.startFfmpeg();
  }

  applyRemoteDescription(desc: OfferAnswer) {
    this.pc.setRemoteDescription(desc.sdp, normalizeDescType(desc.type));
  }

  addRemoteCandidate(ice: IceCandidatePayload) {
    if (!ice?.candidate) return;
    this.pc.addRemoteCandidate(ice.candidate, ice.sdpMid ?? '0');
  }

  close() {
    try {
      this.ffmpeg?.stop();
    } catch {
      // ignore
    }
    this.ffmpeg = null;
    this.feeder = null;
    try {
      this.dc?.close();
    } catch {
      // ignore
    }
    this.dc = null;
    try {
      this.pc.close();
    } catch {
      // ignore
    }
  }

  private wireCoreCallbacks() {
    this.pc.onLocalDescription((sdp, type) => {
      this.callbacks.onLocalDescription({
        sdp,
        type: type.toLowerCase(),
      });
    });
    this.pc.onLocalCandidate((candidate, mid) => {
      this.callbacks.onLocalCandidate({
        candidate,
        sdpMid: mid,
      });
    });
    this.pc.onStateChange((state) => {
      this.opened = state === 'connected';
      this.callbacks.onStateChange?.(state);
    });
    this.pc.onDataChannel((dc) => {
      this.dc = dc;
      dc.onMessage((msg) => {
        const raw = Buffer.isBuffer(msg) ? msg.toString('utf8') : msg;
        this.callbacks.onControlMessage(raw);
      });
      dc.onOpen(() => {
        logger.info({ sessionId: this.cfg.sessionId }, 'ndc control channel open');
      });
    });
  }

  private attachVideoTrack() {
    const video = new Video('video', 'SendOnly' as Direction);
    video.addH264Codec(102, '42e01f');
    video.addSSRC(22222222, 'ndc', 'stream', 'track');
    video.setBitrate(this.cfg.bitrateKbps * 1000);
    const track = this.pc.addTrack(video);
    this.feeder = new H264TrackFeeder(track, 22222222, 102, 90_000);
    this.startFfmpeg();
  }

  private startFfmpeg() {
    this.ffmpeg = new FfmpegSession({
      ffmpegPath: this.cfg.ffmpegPath,
      encoder: this.cfg.preferredEncoder,
      fps: this.cfg.fps,
      bitrateKbps: this.cfg.bitrateKbps,
      keyint: this.cfg.keyint,
      preset: this.cfg.preset,
      qualityProfile: this.cfg.qualityProfile,
      captureInput: 'desktop',
      output: 'h264',
      onChunk: (buf) => this.feeder?.pushChunk(buf),
      onExit: (code, err) => {
        logger.warn(
          { sessionId: this.cfg.sessionId, code, err },
          'ndc ffmpeg exited',
        );
      },
    });
    this.bytesSentAtStart = this.pc.bytesSent();
    this.ffmpeg.start();
  }
}

function normalizeDescType(type: string): DescriptionType {
  if (type === 'offer' || type === 'answer' || type === 'pranswer' || type === 'rollback') {
    return type;
  }
  return 'offer';
}

function normalizeIceServers(servers: IceServer[]): string[] {
  const out: string[] = [];
  for (const s of servers || []) {
    for (const u of s.urls || []) {
      out.push(u);
    }
  }
  if (!out.length) out.push('stun:stun.l.google.com:19302');
  return out;
}
