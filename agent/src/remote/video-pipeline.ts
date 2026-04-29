import * as wrtc from '@roamhq/wrtc';

export interface EncodeTarget {
  fps: number;
  bitrateKbps: number;
  scale: number;
}

export interface PipelineContext {
  pc: wrtc.RTCPeerConnection;
  source: wrtc.nonstandard.RTCVideoSource;
  rgbaToI420: typeof wrtc.nonstandard.rgbaToI420;
}

export interface VideoPipelineStats {
  encodeQueueDelayMs?: number;
  effectiveBitrateKbps?: number;
  keyframeInterval?: number;
  restartCount?: number;
  dirtyTiles?: number;
  totalTiles?: number;
  dirtyRatio?: number;
}

export interface VideoPipeline {
  readonly name: 'software' | 'ffmpeg';
  start(): Promise<void>;
  stop(): Promise<void>;
  updateTarget(target: EncodeTarget): void;
  getStats(): VideoPipelineStats;
}
