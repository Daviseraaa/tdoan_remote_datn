import { io, Socket } from 'socket.io-client';
import * as wrtc from '@roamhq/wrtc';
import { config } from '../config';
import { logger } from '../logger';
import { WS_EVENTS } from '../types';
import { applyRemoteControl, invalidateScreenCache } from './input-controller';
import { RealtimeMetrics, RealtimeSnapshot } from './realtime-metrics';
import { AdaptivePolicy } from './adaptive-policy';
import { EncodeTarget, PipelineContext, VideoPipeline } from './video-pipeline';
import { SoftwareVideoPipeline, TilePatchFrameInfo } from './software-video-pipeline';
import { packTilePatchMessage, TILE_PATCH_CHANNEL_LABEL } from './tile-patch/patch-packer';
import { FfmpegVideoPipeline } from './ffmpeg-video-pipeline';
import { createSdpBridgeConfig } from './native-encoder/sdp-bridge';
import { NdcPeerSession } from './node-datachannel/ndc-peer';
import { normalizeIceInitForWrtc, WrtcIceCandidateInit } from './ice-candidate-wrtc';

type IceServer = { urls: string[]; username?: string; credential?: string };

export interface RemoteSessionPayload {
  sessionId: string;
  agentSignalingToken: string;
  iceServers: IceServer[];
  qualityProfile?: 'low-latency' | 'balanced' | 'high-quality';
  preferredRegion?: string;
  mediaEngine?: 'wrtc' | 'ndc';
}

const CONTROL_CHANNEL_LABEL = 'control';

export class RemotePeer {
  private remoteSocket: Socket | null = null;
  private pc: wrtc.RTCPeerConnection | null = null;
  private videoSource: wrtc.nonstandard.RTCVideoSource | null = null;
  private rgbaToI420: typeof wrtc.nonstandard.rgbaToI420 | null = null;
  private disposed = false;
  private readonly metrics: RealtimeMetrics;
  private readonly policy: AdaptivePolicy;
  private controlChannel: wrtc.RTCDataChannel | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastStatsSample: { bytes?: number; lost?: number; at?: number } = {};
  private videoPipeline: VideoPipeline | null = null;
  private pipelineKind: 'software' | 'ffmpeg' = 'software';
  private ndcSession: NdcPeerSession | null = null;
  private forceWrtcFallback = false;
  private captureRegion: { x: number; y: number; width: number; height: number } | null = null;
  private tilePatchChannel: wrtc.RTCDataChannel | null = null;
  private patchFrameSeq = 0;
  private patchBudgetWindowStart = Date.now();
  private patchBudgetBytes = 0;
  /** NDc: bitrate từ delta `bytesSent` (tổng bytes không phải kbps/giây). */
  private ndcBitratePrev: { bytes: number; at: number } | null = null;
  /** Serialize offer handling; duplicate answers break browser (stable + second answer). */
  private offerChain: Promise<void> = Promise.resolve();
  private lastAppliedOfferSdp: string | null = null;
  private readonly iceQueue: WrtcIceCandidateInit[] = [];

  constructor(readonly payload: RemoteSessionPayload) {
    this.policy = new AdaptivePolicy({
      minFps: config.remote.minFps,
      maxFps: config.remote.maxFps,
      targetFps: config.remote.targetFps,
      goodRttMs: config.remote.goodRttMs,
      badRttMs: config.remote.badRttMs,
      goodLoss: config.remote.goodLoss,
      badLoss: config.remote.badLoss,
      cooldownMs: config.remote.adaptiveCooldownMs,
      stepFps: config.remote.fpsStep,
      minBitrateKbps: config.remote.h264MinBitrateKbps,
      maxBitrateKbps: config.remote.h264MaxBitrateKbps,
      bitrateStepKbps: config.remote.h264BitrateStepKbps,
      minScale: config.remote.scaleMin,
      maxScale: config.remote.scaleMax,
      scaleStep: config.remote.scaleStep,
    }, payload.qualityProfile ?? config.remote.qualityProfile);
    this.metrics = new RealtimeMetrics(
      this.sessionId,
      config.remote.telemetryIntervalMs,
      () => this.policy.target.fps,
    );
    this.metrics.setQualityProfile(payload.qualityProfile ?? config.remote.qualityProfile);
  }

  get sessionId(): string {
    return this.payload.sessionId;
  }

  isControlChannelOpen(): boolean {
    if (this.ndcSession) return this.ndcSession.isControlOpen();
    return !!this.controlChannel && this.controlChannel.readyState === 'open';
  }

  async start() {
    const url = new URL(config.serverUrl);
    const base = `${url.protocol}//${url.host}`;

    this.remoteSocket = io(`${base}/ws/remote`, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: {
        token: this.payload.agentSignalingToken,
        agentKey: config.agentKey,
      },
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 2000,
    });

    this.remoteSocket.on('connect', () => {
      logger.info({ sessionId: this.sessionId }, 'Remote signaling connected');
      if (this.payload.preferredRegion) {
        this.remoteSocket?.emit(WS_EVENTS.REMOTE_RTT_REPORT, {
          region: this.payload.preferredRegion,
          rttMs: 0,
        });
      }
    });

    this.remoteSocket.on(WS_EVENTS.REMOTE_OFFER, (msg: { payload?: unknown }) => {
      void this.onOffer(msg?.payload);
    });

    this.remoteSocket.on(WS_EVENTS.REMOTE_ICE, (msg: { payload?: unknown }) => {
      void this.onIce(msg?.payload);
    });

    invalidateScreenCache();

    if (config.remote.telemetryEnabled) {
      this.metrics.start((snap) => this.onTelemetry(snap));
    }
  }

  private ensurePeer() {
    const mode = this.payload.mediaEngine || config.remote.mediaEngine;
    if (mode === 'ndc' && !this.forceWrtcFallback) {
      this.ensureNdcPeer();
      return;
    }
    if (this.pc) return;
    const iceServers = this.payload.iceServers?.length
      ? this.payload.iceServers
      : [{ urls: ['stun:stun.l.google.com:19302'] }];

    const pc = new wrtc.RTCPeerConnection({ iceServers });
    this.pc = pc;

    pc.onicecandidate = (ev) => {
      if (this.disposed || !ev.candidate || !this.remoteSocket) return;
      this.remoteSocket.emit(WS_EVENTS.REMOTE_ICE, {
        payload: ev.candidate.toJSON(),
      });
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      logger.info({ sessionId: this.sessionId, st }, 'remote pc state');
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        void this.dispose();
      }
    };

    if (config.remote.dataChannelEnabled) {
      pc.ondatachannel = (ev) => this.attachControlChannel(ev.channel);
    }

    const { RTCVideoSource, rgbaToI420 } = wrtc.nonstandard;
    const source = new RTCVideoSource({ isScreencast: true });
    this.videoSource = source;
    this.rgbaToI420 = rgbaToI420;
    const track = source.createTrack();
    const ms = new wrtc.MediaStream([track]);
    pc.addTrack(track, ms);
    // Keep config object alive for future encoded RTP bridge phases.
    createSdpBridgeConfig();
    this.initVideoPipeline();

    if (config.remote.tilePatchEnabled && config.remote.dataChannelEnabled) {
      const ch = pc.createDataChannel(TILE_PATCH_CHANNEL_LABEL, { ordered: true });
      this.attachTilePatchChannel(ch);
    }

    this.startStatsLoop();
  }

  private ensureNdcPeer() {
    if (this.ndcSession) return;
    const preferred =
      config.remote.h264PreferredEncoder === 'nvenc'
        ? 'h264_nvenc'
        : config.remote.h264PreferredEncoder === 'amf'
          ? 'h264_amf'
          : config.remote.h264PreferredEncoder === 'qsv'
            ? 'h264_qsv'
            : 'libx264';
    this.ndcSession = new NdcPeerSession(
      {
        sessionId: this.sessionId,
        iceServers: this.payload.iceServers,
        ffmpegPath: config.remote.ffmpegPath,
        preferredEncoder: preferred,
        bitrateKbps: this.policy.target.bitrateKbps,
        fps: this.policy.target.fps,
        keyint: config.remote.h264Keyint,
        preset: config.remote.h264Preset,
        qualityProfile: this.payload.qualityProfile ?? config.remote.qualityProfile,
      },
      {
        onLocalDescription: (desc) => {
          this.remoteSocket?.emit(WS_EVENTS.REMOTE_ANSWER, { payload: desc });
        },
        onLocalCandidate: (ice) => {
          this.remoteSocket?.emit(WS_EVENTS.REMOTE_ICE, { payload: ice });
        },
        onControlMessage: (raw) => this.onControlMessage(raw),
        onStateChange: (state) => {
          logger.info({ sessionId: this.sessionId, state }, 'ndc state');
          if (state === 'failed' || state === 'closed' || state === 'disconnected') {
            void this.switchToWrtcFallback();
          }
        },
      },
    );
    this.startStatsLoop();
  }

  private initVideoPipeline() {
    if (!this.pc || !this.videoSource || !this.rgbaToI420) return;
    const ctx: PipelineContext = {
      pc: this.pc,
      source: this.videoSource,
      rgbaToI420: this.rgbaToI420,
    };
    const target = this.policy.target;

    if (config.platform === 'win32' && config.remote.videoPipeline === 'ffmpeg') {
      this.pipelineKind = 'ffmpeg';
      this.videoPipeline = new FfmpegVideoPipeline(ctx, this.metrics, target, {
        ffmpegPath: config.remote.ffmpegPath,
        preferredEncoder: config.remote.h264PreferredEncoder,
        keyint: config.remote.h264Keyint,
        preset: config.remote.h264Preset,
      });
      return;
    }

    this.pipelineKind = 'software';
    this.videoPipeline = new SoftwareVideoPipeline(
      ctx,
      this.metrics,
      target,
      (info: TilePatchFrameInfo) => this.handleTilePatchFrame(info),
    );
  }

  private attachTilePatchChannel(channel: wrtc.RTCDataChannel) {
    if (channel.label !== TILE_PATCH_CHANNEL_LABEL) {
      logger.warn({ sessionId: this.sessionId, label: channel.label }, 'unexpected tilepatch label');
    }
    this.tilePatchChannel = channel;
    channel.onopen = () => {
      logger.info({ sessionId: this.sessionId }, 'tilepatch data channel open');
    };
    channel.onclose = () => {
      logger.info({ sessionId: this.sessionId }, 'tilepatch data channel closed');
      if (this.tilePatchChannel === channel) this.tilePatchChannel = null;
    };
    channel.onerror = (err: unknown) => {
      logger.warn({ sessionId: this.sessionId, err }, 'tilepatch data channel error');
    };
  }

  /**
   * RGBA tile binary patches for admin canvas overlay (software capture + wrtc only).
   */
  private handleTilePatchFrame(info: TilePatchFrameInfo) {
    if (!config.remote.tilePatchEnabled || this.ndcSession || this.pipelineKind !== 'software') return;
    const ch = this.tilePatchChannel;
    if (!ch || ch.readyState !== 'open') return;
    const frameId = ++this.patchFrameSeq;
    const packed = packTilePatchMessage({
      frameId,
      screenWidth: info.screenWidth,
      screenHeight: info.screenHeight,
      tileSize: info.tileSize,
      rgba: info.rgba,
      rects: info.rects,
      maxTiles: config.remote.tilePatchMaxTilesPerFrame,
    });
    if (!packed) {
      this.metrics.markPatchDrop('max_tiles_or_empty');
      return;
    }
    if (!this.consumePatchBudget(packed.length)) {
      this.metrics.markPatchDrop('budget');
      return;
    }
    try {
      const u8 = new Uint8Array(packed.length);
      u8.set(packed);
      ch.send(u8);
      this.metrics.markPatchSent(packed.length, info.rects.length);
    } catch (err) {
      logger.warn({ sessionId: this.sessionId, err }, 'tilepatch send failed');
      this.metrics.markPatchDrop('send');
    }
  }

  private consumePatchBudget(byteLen: number): boolean {
    const now = Date.now();
    if (now - this.patchBudgetWindowStart >= 1000) {
      this.patchBudgetWindowStart = now;
      this.patchBudgetBytes = 0;
    }
    const max = Math.max(1024, config.remote.tilePatchMaxBytesPerSec);
    if (this.patchBudgetBytes + byteLen > max) return false;
    this.patchBudgetBytes += byteLen;
    return true;
  }

  private attachControlChannel(channel: wrtc.RTCDataChannel) {
    if (channel.label !== CONTROL_CHANNEL_LABEL) {
      logger.warn(
        { sessionId: this.sessionId, label: channel.label },
        'unexpected data channel label',
      );
    }
    this.controlChannel = channel;
    channel.onopen = () => {
      logger.info({ sessionId: this.sessionId }, 'control data channel open');
    };
    channel.onclose = () => {
      logger.info({ sessionId: this.sessionId }, 'control data channel closed');
      if (this.controlChannel === channel) this.controlChannel = null;
    };
    channel.onerror = (err: unknown) => {
      logger.warn({ sessionId: this.sessionId, err }, 'control data channel error');
    };
    channel.onmessage = (ev: MessageEvent) => {
      this.onControlMessage(ev.data);
    };
  }

  private onControlMessage(data: unknown) {
    try {
      const raw = typeof data === 'string' ? data : String(data);
      const msg = JSON.parse(raw) as Record<string, unknown>;
      this.handleControlPayload(msg);
    } catch (err) {
      logger.warn({ sessionId: this.sessionId, err }, 'invalid control message');
    }
  }

  handleControlPayload(msg: Record<string, unknown>) {
    if (msg.type === 'SET_QUALITY_PROFILE') {
      const profile = String(msg.profile || 'balanced') as
        | 'low-latency'
        | 'balanced'
        | 'high-quality';
      this.policy.applyProfile(profile);
      this.metrics.setQualityProfile(profile);
      return;
    }
    if (msg.type === 'SET_CAPTURE_REGION') {
      const x = Number(msg.x);
      const y = Number(msg.y);
      const width = Number(msg.width);
      const height = Number(msg.height);
      if (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(width) &&
        Number.isFinite(height)
      ) {
        this.captureRegion = { x, y, width, height };
      }
      return;
    }
    void applyRemoteControl(msg);
  }

  private onOffer(raw: unknown) {
    this.offerChain = this.offerChain
      .then(() => this.handleOffer(raw))
      .catch((err) => {
        logger.error({ sessionId: this.sessionId, err }, 'remote offer chain failed');
      });
    void this.offerChain;
  }

  private async handleOffer(raw: unknown) {
    if (this.disposed || !raw || typeof raw !== 'object') return;
    const init = raw as { type: string; sdp: string };
    if (!init.sdp) return;

    try {
      this.ensurePeer();
      if (this.ndcSession) {
        this.ndcSession.applyRemoteDescription({ type: init.type, sdp: init.sdp });
        return;
      }
      const pc = this.pc!;
      if (this.lastAppliedOfferSdp === init.sdp && pc.signalingState === 'stable') {
        logger.info({ sessionId: this.sessionId }, 'ignoring duplicate remote offer');
        return;
      }
      await pc.setRemoteDescription(new wrtc.RTCSessionDescription(init as never));
      await this.flushIceQueue();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.flushIceQueue();
      this.lastAppliedOfferSdp = init.sdp;
      this.remoteSocket?.emit(WS_EVENTS.REMOTE_ANSWER, {
        payload: pc.localDescription ?? answer,
      });
      await this.videoPipeline?.start();
    } catch (err) {
      logger.error({ sessionId: this.sessionId, err }, 'remote offer handling failed');
      if (config.remote.mediaEngine === 'ndc') {
        await this.switchToWrtcFallback();
      }
    }
  }

  private async flushIceQueue() {
    if (!this.pc || this.disposed) return;
    while (this.iceQueue.length) {
      const ice = this.iceQueue.shift()!;
      try {
        await this.pc.addIceCandidate(new wrtc.RTCIceCandidate(ice as never));
      } catch (err) {
        logger.warn({ sessionId: this.sessionId, err }, 'addIceCandidate failed');
      }
    }
  }

  private async onIce(raw: unknown) {
    if (this.disposed || !raw) return;
    const ice = normalizeIceInitForWrtc(raw);
    if (!ice) return;
    if (this.ndcSession) {
      this.ndcSession.addRemoteCandidate({ candidate: ice.candidate, sdpMid: ice.sdpMid });
      return;
    }
    if (!this.pc) return;
    if (!this.pc.remoteDescription) {
      this.iceQueue.push(ice);
      return;
    }
    try {
      await this.pc.addIceCandidate(new wrtc.RTCIceCandidate(ice as never));
    } catch (err) {
      logger.warn({ sessionId: this.sessionId, err }, 'addIceCandidate failed');
    }
  }

  private startStatsLoop() {
    if (!config.remote.telemetryEnabled || this.statsTimer) return;
    this.statsTimer = setInterval(() => {
      void this.collectPeerStats();
    }, config.remote.telemetryIntervalMs);
  }

  private async collectPeerStats() {
    if (this.disposed) return;
    try {
      if (this.pc) {
        const report = await this.pc.getStats();
      let rttMs: number | undefined;
      let packetsLost: number | undefined;
      let packetsSent: number | undefined;
      let jitterMs: number | undefined;

      report.forEach((stat: Record<string, unknown>) => {
        const kind = stat.kind as string | undefined;
        const type = stat.type as string | undefined;
        if (type === 'remote-inbound-rtp' && kind === 'video') {
          if (typeof stat.roundTripTime === 'number') {
            rttMs = Math.round((stat.roundTripTime as number) * 1000);
          }
          if (typeof stat.packetsLost === 'number') {
            packetsLost = stat.packetsLost as number;
          }
          if (typeof stat.jitter === 'number') {
            jitterMs = Math.round((stat.jitter as number) * 1000);
          }
        }
        if (type === 'outbound-rtp' && kind === 'video') {
          if (typeof stat.packetsSent === 'number') {
            packetsSent = stat.packetsSent as number;
          }
        }
      });

      let packetLoss: number | undefined;
      if (typeof packetsLost === 'number' && typeof packetsSent === 'number') {
        const prev = this.lastStatsSample;
        const deltaLost = packetsLost - (prev.lost ?? packetsLost);
        const deltaSent = packetsSent - (prev.bytes ?? packetsSent);
        if (deltaSent > 0) {
          packetLoss = Math.max(0, deltaLost / deltaSent);
        }
        this.lastStatsSample = { lost: packetsLost, bytes: packetsSent, at: Date.now() };
      }

        this.metrics.updateNetwork({ rttMs, packetLoss, jitterMs });
      }
      const pstats = this.videoPipeline?.getStats();
      if (this.ndcSession) {
        const ns = this.ndcSession.stats();
        const rtt =
          typeof ns.rttMs === 'number' && Number.isFinite(ns.rttMs) && ns.rttMs >= 0
            ? ns.rttMs
            : undefined;
        this.metrics.updateNetwork({ rttMs: rtt });
        this.metrics.updateEncoder({
          ffmpegRestartCount: ns.restartCount,
        });
      }
      if (pstats) {
        this.metrics.updateEncoder({
          encodeQueueDelayMs: pstats.encodeQueueDelayMs,
          effectiveBitrateKbps: pstats.effectiveBitrateKbps,
          keyframeInterval: pstats.keyframeInterval,
          ffmpegRestartCount: pstats.restartCount,
          dirtyTiles: pstats.dirtyTiles,
          totalTiles: pstats.totalTiles,
          dirtyRatio: pstats.dirtyRatio,
        });
      }
      const currentNet = this.metrics.currentNetwork();
      if (
        this.payload.preferredRegion &&
        typeof currentNet.rttMs === 'number' &&
        Number.isFinite(currentNet.rttMs)
      ) {
        this.remoteSocket?.emit(WS_EVENTS.REMOTE_RTT_REPORT, {
          region: this.payload.preferredRegion,
          rttMs: currentNet.rttMs,
        });
      }
    } catch (err) {
      logger.warn({ sessionId: this.sessionId, err }, 'getStats failed');
    }
  }

  private onTelemetry(snap: RealtimeSnapshot) {
    const merged = this.mergeSnapshotForTelemetry(snap);
    if (this.remoteSocket?.connected) {
      const tilePatchDcAvailable =
        config.remote.tilePatchEnabled &&
        config.remote.dataChannelEnabled &&
        !this.ndcSession &&
        this.pipelineKind === 'software';
      this.remoteSocket.emit(WS_EVENTS.REMOTE_TELEMETRY, {
        payload: {
          ...merged,
          sessionId: this.sessionId,
          mediaEngine: this.ndcSession ? 'ndc' : 'wrtc',
          pipeline: this.ndcSession ? 'ndc-h264' : this.pipelineKind,
          captureRegion: this.captureRegion,
          /** NDC/ffmpeg không gửi tile-patch qua DC; admin hiển thị n/a thay vì 0. */
          screenMetricsAvailable: !!this.videoPipeline,
          tilePatchDcAvailable,
        },
      });
    } else {
      logger.warn({ sessionId: this.sessionId }, 'remote telemetry not sent: signaling socket not connected');
    }
    if (!config.remote.adaptiveEnabled) return;
    const prev = this.policy.target;
    const res = this.policy.evaluate(merged);
    this.videoPipeline?.updateTarget(res.target);
    if (this.ndcSession) {
      this.ndcSession.setTarget({
        fps: res.target.fps,
        bitrateKbps: res.target.bitrateKbps,
      });
    }
    const pstats = this.videoPipeline?.getStats();
    if (this.pipelineKind === 'ffmpeg' && (pstats?.restartCount ?? 0) > 0) {
      logger.warn(
        { sessionId: this.sessionId, restartCount: pstats?.restartCount },
        'ffmpeg unstable, switching to software pipeline',
      );
      void this.switchToSoftwarePipeline(res.target);
    }
    if (res.changed) {
      logger.info(
        {
          sessionId: this.sessionId,
          reason: res.reason,
          prevTarget: prev,
          nextTarget: res.target,
        },
        'adaptive target change',
      );
    }
  }

  /**
   * Nhánh ndc không gọi markSent() (không có SoftwareVideoPipeline) — bổ sung FPS/bitrate thật cho UI.
   */
  private mergeSnapshotForTelemetry(snap: RealtimeSnapshot): RealtimeSnapshot {
    if (!this.ndcSession) return snap;
    const ns = this.ndcSession.stats();
    const targetFps = this.policy.target.fps;
    const out: RealtimeSnapshot = {
      ...snap,
      effectiveFps: targetFps,
      targetFps,
    };
    if (typeof ns.rttMs === 'number' && Number.isFinite(ns.rttMs) && ns.rttMs > 0) {
      out.rttMs = Math.round(ns.rttMs);
    }
    if (typeof ns.bytesSent === 'number' && Number.isFinite(ns.bytesSent)) {
      const now = Date.now();
      const prev = this.ndcBitratePrev;
      this.ndcBitratePrev = { bytes: ns.bytesSent, at: now };
      if (prev) {
        const dt = (now - prev.at) / 1000;
        const delta = ns.bytesSent - prev.bytes;
        if (dt > 0.05 && delta >= 0) {
          out.effectiveBitrateKbps = Math.round((delta * 8) / 1000 / dt);
        }
      }
    }
    return out;
  }

  private async switchToSoftwarePipeline(target: EncodeTarget) {
    if (this.disposed || !this.pc || !this.videoSource || !this.rgbaToI420) return;
    if (this.pipelineKind === 'software') return;
    try {
      await this.videoPipeline?.stop();
    } catch {
      // ignore
    }
    this.videoPipeline = new SoftwareVideoPipeline(
      { pc: this.pc, source: this.videoSource, rgbaToI420: this.rgbaToI420 },
      this.metrics,
      target,
      (info: TilePatchFrameInfo) => this.handleTilePatchFrame(info),
    );
    this.pipelineKind = 'software';
    await this.videoPipeline.start();
  }

  private async switchToWrtcFallback() {
    if (this.disposed || this.pc) return;
    logger.warn({ sessionId: this.sessionId }, 'switching ndc -> wrtc fallback');
    this.ndcSession?.close();
    this.ndcSession = null;
    this.ndcBitratePrev = null;
    this.forceWrtcFallback = true;
    this.iceQueue.length = 0;
    this.lastAppliedOfferSdp = null;
    this.ensurePeer();
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    await this.videoPipeline?.stop();
    this.videoPipeline = null;
    this.ndcSession?.close();
    this.ndcSession = null;
    this.ndcBitratePrev = null;
    this.forceWrtcFallback = false;
    if (this.statsTimer) {
      clearInterval(this.statsTimer);
      this.statsTimer = null;
    }
    this.metrics.stop();
    if (this.controlChannel) {
      try {
        this.controlChannel.close();
      } catch {
        /* ignore */
      }
      this.controlChannel = null;
    }
    if (this.tilePatchChannel) {
      try {
        this.tilePatchChannel.close();
      } catch {
        /* ignore */
      }
      this.tilePatchChannel = null;
    }
    try {
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.videoSource = null;
    this.rgbaToI420 = null;
    try {
      this.remoteSocket?.disconnect();
    } catch {
      /* ignore */
    }
    this.remoteSocket = null;
    this.iceQueue.length = 0;
    this.lastAppliedOfferSdp = null;
    this.offerChain = Promise.resolve();
    logger.info({ sessionId: this.sessionId }, 'Remote peer disposed');
  }
}
