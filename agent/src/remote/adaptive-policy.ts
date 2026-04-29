import { RealtimeSnapshot } from './realtime-metrics';
import { EncodeTarget } from './video-pipeline';

export interface AdaptiveConfig {
  minFps: number;
  maxFps: number;
  targetFps: number;
  goodRttMs: number;
  badRttMs: number;
  goodLoss: number;
  badLoss: number;
  cooldownMs: number;
  stepFps: number;
  minBitrateKbps: number;
  maxBitrateKbps: number;
  bitrateStepKbps: number;
  minScale: number;
  maxScale: number;
  scaleStep: number;
}

export class AdaptivePolicy {
  private readonly cfg: AdaptiveConfig;
  private currentFps: number;
  private currentBitrateKbps: number;
  private currentScale: number;
  private lastChangeAt = 0;
  private profile: 'low-latency' | 'balanced' | 'high-quality' = 'balanced';

  constructor(cfg: AdaptiveConfig, profile: 'low-latency' | 'balanced' | 'high-quality' = 'balanced') {
    const tuned = tuneByProfile(cfg, profile);
    this.profile = profile;
    this.cfg = tuned;
    this.currentFps = clamp(cfg.targetFps, cfg.minFps, cfg.maxFps);
    this.currentFps = clamp(tuned.targetFps, tuned.minFps, tuned.maxFps);
    this.currentBitrateKbps = clamp(
      Math.round((tuned.minBitrateKbps + tuned.maxBitrateKbps) / 2),
      tuned.minBitrateKbps,
      tuned.maxBitrateKbps,
    );
    this.currentScale = clamp(tuned.maxScale, tuned.minScale, tuned.maxScale);
    this.cfg = tuned;
  }

  get target(): EncodeTarget {
    return {
      fps: this.currentFps,
      bitrateKbps: this.currentBitrateKbps,
      scale: this.currentScale,
    };
  }

  evaluate(snap: RealtimeSnapshot): { target: EncodeTarget; changed: boolean; reason: string } {
    const now = Date.now();
    if (now - this.lastChangeAt < this.cfg.cooldownMs) {
      return { target: this.target, changed: false, reason: 'cooldown' };
    }

    const rtt = snap.rttMs ?? 0;
    const loss = snap.packetLoss ?? 0;
    const dropRate =
      snap.framesCaptured > 0 ? snap.framesDropped / snap.framesCaptured : 0;

    const cpuBound = (snap.captureMsAvg ?? 0) + (snap.convertMsAvg ?? 0) > 45;
    const badNetwork =
      (rtt > 0 && rtt > this.cfg.badRttMs) ||
      loss > this.cfg.badLoss ||
      dropRate > 0.3 ||
      cpuBound;

    const goodNetwork =
      (rtt === 0 || rtt <= this.cfg.goodRttMs) &&
      loss <= this.cfg.goodLoss &&
      dropRate < 0.05;

    let nextFps = this.currentFps;
    let nextBitrate = this.currentBitrateKbps;
    let nextScale = this.currentScale;
    let reason = 'steady';

    if (badNetwork) {
      nextFps = Math.max(this.cfg.minFps, this.currentFps - this.cfg.stepFps);
      nextBitrate = Math.max(
        this.cfg.minBitrateKbps,
        this.currentBitrateKbps - this.cfg.bitrateStepKbps,
      );
      nextScale = clamp(this.currentScale - this.cfg.scaleStep, this.cfg.minScale, this.cfg.maxScale);
      reason = 'degrade';
    } else if (goodNetwork) {
      nextFps = Math.min(this.cfg.maxFps, this.currentFps + this.cfg.stepFps);
      nextBitrate = Math.min(
        this.cfg.maxBitrateKbps,
        this.currentBitrateKbps + this.cfg.bitrateStepKbps,
      );
      nextScale = clamp(this.currentScale + this.cfg.scaleStep, this.cfg.minScale, this.cfg.maxScale);
      reason = 'recover';
    }

    const changed =
      nextFps !== this.currentFps ||
      nextBitrate !== this.currentBitrateKbps ||
      nextScale !== this.currentScale;
    if (changed) {
      this.currentFps = nextFps;
      this.currentBitrateKbps = nextBitrate;
      this.currentScale = nextScale;
      this.lastChangeAt = now;
    }
    return { target: this.target, changed, reason };
  }

  applyProfile(profile: 'low-latency' | 'balanced' | 'high-quality') {
    this.profile = profile;
    const tuned = tuneByProfile(this.cfg, profile);
    this.currentFps = clamp(tuned.targetFps, tuned.minFps, tuned.maxFps);
    this.currentBitrateKbps = clamp(
      Math.round((tuned.minBitrateKbps + tuned.maxBitrateKbps) / 2),
      tuned.minBitrateKbps,
      tuned.maxBitrateKbps,
    );
    this.currentScale = clamp(tuned.maxScale, tuned.minScale, tuned.maxScale);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function tuneByProfile(cfg: AdaptiveConfig, profile: 'low-latency' | 'balanced' | 'high-quality'): AdaptiveConfig {
  if (profile === 'low-latency') {
    return {
      ...cfg,
      targetFps: Math.max(cfg.targetFps, 20),
      minBitrateKbps: Math.min(cfg.minBitrateKbps, 600),
      maxBitrateKbps: Math.min(cfg.maxBitrateKbps, 3500),
      minScale: Math.max(cfg.minScale, 0.5),
    };
  }
  if (profile === 'high-quality') {
    return {
      ...cfg,
      targetFps: Math.max(cfg.targetFps, 25),
      minBitrateKbps: Math.max(cfg.minBitrateKbps, 1200),
      maxBitrateKbps: Math.max(cfg.maxBitrateKbps, 8000),
      minScale: Math.max(cfg.minScale, 0.7),
      goodRttMs: Math.min(cfg.goodRttMs, 60),
    };
  }
  return cfg;
}
