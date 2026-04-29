import { logger } from '../logger';

export interface PeerNetworkStats {
  rttMs?: number;
  packetLoss?: number;
  jitterMs?: number;
}

export interface RealtimeSnapshot {
  framesCaptured: number;
  framesSent: number;
  framesDropped: number;
  captureMsAvg: number;
  convertMsAvg: number;
  effectiveFps: number;
  targetFps: number;
  rttMs?: number;
  packetLoss?: number;
  jitterMs?: number;
  encodeQueueDelayMs?: number;
  effectiveBitrateKbps?: number;
  keyframeInterval?: number;
  ffmpegRestartCount?: number;
  dirtyTiles?: number;
  totalTiles?: number;
  dirtyRatio?: number;
  qualityProfile?: string;
  patchBytes: number;
  patchTiles: number;
  patchDropCount: number;
}

export class RealtimeMetrics {
  private framesCaptured = 0;
  private framesSent = 0;
  private framesDropped = 0;
  private captureMsTotal = 0;
  private captureMsSamples = 0;
  private convertMsTotal = 0;
  private convertMsSamples = 0;
  private windowStart = Date.now();
  private sentInWindow = 0;
  private net: PeerNetworkStats = {};
  private reportTimer: ReturnType<typeof setInterval> | null = null;
  /** Bắn snapshot đầu sau delay ngắn để NDc/WebRTC kịp khởi tạo (tránh UI toàn 0 đến hết interval đầu). */
  private firstReportTimer: ReturnType<typeof setTimeout> | null = null;
  private encoder: {
    encodeQueueDelayMs?: number;
    effectiveBitrateKbps?: number;
    keyframeInterval?: number;
    ffmpegRestartCount?: number;
  } = {};
  private qualityProfile = 'balanced';
  private patchBytesWindow = 0;
  private patchTilesWindow = 0;
  private patchDropsWindow = 0;

  constructor(
    private readonly sessionId: string,
    private readonly reportIntervalMs: number,
    private readonly targetFpsProvider: () => number,
  ) {}

  start(onSnapshot?: (snap: RealtimeSnapshot) => void) {
    if (this.reportTimer || this.firstReportTimer) return;
    const fire = () => {
      const snap = this.takeSnapshot();
      logger.info({ sessionId: this.sessionId, ...snap }, 'remote telemetry');
      onSnapshot?.(snap);
    };
    this.firstReportTimer = setTimeout(() => {
      this.firstReportTimer = null;
      fire();
      this.reportTimer = setInterval(fire, this.reportIntervalMs);
    }, 2000);
  }

  stop() {
    if (this.firstReportTimer) {
      clearTimeout(this.firstReportTimer);
      this.firstReportTimer = null;
    }
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  markCaptureDone(elapsedMs: number) {
    this.framesCaptured++;
    this.captureMsTotal += elapsedMs;
    this.captureMsSamples++;
  }

  markConvert(elapsedMs: number) {
    this.convertMsTotal += elapsedMs;
    this.convertMsSamples++;
  }

  markSent() {
    this.framesSent++;
    this.sentInWindow++;
  }

  markDropped() {
    this.framesDropped++;
  }

  updateNetwork(stats: PeerNetworkStats) {
    if (typeof stats.rttMs === 'number') this.net.rttMs = stats.rttMs;
    if (typeof stats.packetLoss === 'number') this.net.packetLoss = stats.packetLoss;
    if (typeof stats.jitterMs === 'number') this.net.jitterMs = stats.jitterMs;
  }

  updateEncoder(stats: {
    encodeQueueDelayMs?: number;
    effectiveBitrateKbps?: number;
    keyframeInterval?: number;
    ffmpegRestartCount?: number;
    dirtyTiles?: number;
    totalTiles?: number;
    dirtyRatio?: number;
  }) {
    if (typeof stats.encodeQueueDelayMs === 'number') {
      this.encoder.encodeQueueDelayMs = stats.encodeQueueDelayMs;
    }
    if (typeof stats.effectiveBitrateKbps === 'number') {
      this.encoder.effectiveBitrateKbps = stats.effectiveBitrateKbps;
    }
    if (typeof stats.keyframeInterval === 'number') {
      this.encoder.keyframeInterval = stats.keyframeInterval;
    }
    if (typeof stats.ffmpegRestartCount === 'number') {
      this.encoder.ffmpegRestartCount = stats.ffmpegRestartCount;
    }
    if (typeof stats.dirtyTiles === 'number') {
      (this.encoder as Record<string, number>).dirtyTiles = stats.dirtyTiles;
    }
    if (typeof stats.totalTiles === 'number') {
      (this.encoder as Record<string, number>).totalTiles = stats.totalTiles;
    }
    if (typeof stats.dirtyRatio === 'number') {
      (this.encoder as Record<string, number>).dirtyRatio = stats.dirtyRatio;
    }
  }

  setQualityProfile(profile: string) {
    this.qualityProfile = profile;
  }

  markPatchSent(bytes: number, tiles: number) {
    if (bytes > 0) this.patchBytesWindow += bytes;
    if (tiles > 0) this.patchTilesWindow += tiles;
  }

  markPatchDrop(_reason?: string) {
    this.patchDropsWindow++;
  }

  currentNetwork(): PeerNetworkStats {
    return { ...this.net };
  }

  takeSnapshot(): RealtimeSnapshot {
    const now = Date.now();
    const windowSec = Math.max(0.001, (now - this.windowStart) / 1000);
    const effectiveFps = this.sentInWindow / windowSec;
    const captureMsAvg =
      this.captureMsSamples > 0 ? this.captureMsTotal / this.captureMsSamples : 0;
    const convertMsAvg =
      this.convertMsSamples > 0 ? this.convertMsTotal / this.convertMsSamples : 0;

    const snap: RealtimeSnapshot = {
      framesCaptured: this.framesCaptured,
      framesSent: this.framesSent,
      framesDropped: this.framesDropped,
      captureMsAvg: round2(captureMsAvg),
      convertMsAvg: round2(convertMsAvg),
      effectiveFps: round2(effectiveFps),
      targetFps: this.targetFpsProvider(),
      rttMs: this.net.rttMs,
      packetLoss: this.net.packetLoss,
      jitterMs: this.net.jitterMs,
      encodeQueueDelayMs: this.encoder.encodeQueueDelayMs,
      effectiveBitrateKbps: this.encoder.effectiveBitrateKbps,
      keyframeInterval: this.encoder.keyframeInterval,
      ffmpegRestartCount: this.encoder.ffmpegRestartCount,
      dirtyTiles: (this.encoder as Record<string, number>).dirtyTiles,
      totalTiles: (this.encoder as Record<string, number>).totalTiles,
      dirtyRatio: (this.encoder as Record<string, number>).dirtyRatio,
      qualityProfile: this.qualityProfile,
      /** Luôn là số (kể cả 0) để UI không nhầm với “thiếu field”. */
      patchBytes: this.patchBytesWindow,
      patchTiles: Math.round(this.patchTilesWindow),
      patchDropCount: this.patchDropsWindow,
    };

    this.patchBytesWindow = 0;
    this.patchTilesWindow = 0;
    this.patchDropsWindow = 0;

    this.windowStart = now;
    this.sentInWindow = 0;
    this.captureMsTotal = 0;
    this.captureMsSamples = 0;
    this.convertMsTotal = 0;
    this.convertMsSamples = 0;

    return snap;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
