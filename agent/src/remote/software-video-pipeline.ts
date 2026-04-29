import { screen } from '@nut-tree-fork/nut-js';
import * as wrtc from '@roamhq/wrtc';
import { FrameBufferPool } from './frame-buffers';
import { RealtimeMetrics } from './realtime-metrics';
import { EncodeTarget, PipelineContext, VideoPipeline, VideoPipelineStats } from './video-pipeline';
import { computeDirtyTiles, DirtyTileSummary } from './tile-diff';
import { config } from '../config';

/** Passed once per encoded video frame when tile patch overlay is enabled */
export type TilePatchFrameInfo = {
  screenWidth: number;
  screenHeight: number;
  tileSize: number;
  rgba: Uint8Array;
  rects: Array<{ x: number; y: number; w: number; h: number }>;
};

export class SoftwareVideoPipeline implements VideoPipeline {
  readonly name = 'software' as const;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private capturing = false;
  private running = false;
  private target: EncodeTarget;
  private readonly buffers = new FrameBufferPool();
  private prevRgba: Uint8Array | null = null;
  private lastDirty: DirtyTileSummary = {
    dirtyTiles: 0,
    totalTiles: 0,
    dirtyRatio: 0,
    rects: [],
  };

  constructor(
    private readonly ctx: PipelineContext,
    private readonly metrics: RealtimeMetrics,
    initialTarget: EncodeTarget,
    private readonly onTilePatchFrame?: (info: TilePatchFrameInfo) => void,
  ) {
    this.target = initialTarget;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffers.release();
    this.prevRgba = null;
  }

  updateTarget(target: EncodeTarget): void {
    this.target = target;
  }

  getStats(): VideoPipelineStats {
    return {
      dirtyTiles: this.lastDirty.dirtyTiles,
      totalTiles: this.lastDirty.totalTiles,
      dirtyRatio: this.lastDirty.dirtyRatio,
    };
  }

  private schedule() {
    if (!this.running || this.timer) return;
    const interval = Math.max(1, Math.round(1000 / Math.max(1, this.target.fps)));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, interval);
  }

  private async tick() {
    if (!this.running) return;
    if (this.capturing) {
      this.metrics.markDropped();
      this.schedule();
      return;
    }
    this.capturing = true;
    try {
      await this.pushFrame();
    } finally {
      this.capturing = false;
      this.schedule();
    }
  }

  private async pushFrame() {
    const capStart = Date.now();
    try {
      const img = await screen.grab();
      const rgb = await img.toRGB();
      this.metrics.markCaptureDone(Date.now() - capStart);

      const scale = Math.max(0.25, Math.min(1, this.target.scale));
      const scaledW = Math.max(2, Math.round(rgb.width * scale));
      const scaledH = Math.max(2, Math.round(rgb.height * scale));
      const w = scaledW & ~1;
      const h = scaledH & ~1;

      const buf = this.buffers.ensure(w, h);
      const convStart = Date.now();

      const src = rgb.data;
      const srcWidth = rgb.width;
      const srcChannels = rgb.channels;
      for (let row = 0; row < h; row++) {
        const srcRow = Math.min(rgb.height - 1, Math.floor(row / scale));
        for (let col = 0; col < w; col++) {
          const srcCol = Math.min(srcWidth - 1, Math.floor(col / scale));
          const di = (row * w + col) * 4;
          if (srcChannels === 4) {
            const si = (srcRow * srcWidth + srcCol) * 4;
            buf.rgba[di] = src[si]!;
            buf.rgba[di + 1] = src[si + 1]!;
            buf.rgba[di + 2] = src[si + 2]!;
            buf.rgba[di + 3] = src[si + 3]!;
          } else {
            const si = (srcRow * srcWidth + srcCol) * 3;
            buf.rgba[di] = src[si]!;
            buf.rgba[di + 1] = src[si + 1]!;
            buf.rgba[di + 2] = src[si + 2]!;
            buf.rgba[di + 3] = 255;
          }
        }
      }

      const rgbaFrame: wrtc.nonstandard.RTCVideoFrame = {
        width: w,
        height: h,
        data: buf.rgba,
      };
      const i420Frame: wrtc.nonstandard.RTCVideoFrame = {
        width: w,
        height: h,
        data: buf.i420,
      };
      this.ctx.rgbaToI420(rgbaFrame, i420Frame);
      this.metrics.markConvert(Date.now() - convStart);
      if (config.remote.tileDiffEnabled) {
        this.lastDirty = computeDirtyTiles(
          this.prevRgba,
          buf.rgba,
          w,
          h,
          config.remote.tileSize,
          config.remote.tileDiffThreshold,
        );
        // Skip frame if nothing changed to reduce bandwidth/CPU.
        if (this.lastDirty.dirtyTiles === 0) {
          this.metrics.markDropped();
          return;
        }
      } else {
        this.lastDirty = {
          dirtyTiles: 1,
          totalTiles: 1,
          dirtyRatio: 1,
          rects: [{ x: 0, y: 0, w, h }],
        };
      }
      if (
        config.remote.tilePatchEnabled &&
        config.remote.tileDiffEnabled &&
        config.remote.dataChannelEnabled &&
        typeof this.onTilePatchFrame === 'function' &&
        this.lastDirty.rects.length > 0
      ) {
        try {
          this.onTilePatchFrame({
            screenWidth: w,
            screenHeight: h,
            tileSize: config.remote.tileSize,
            rgba: buf.rgba,
            rects: this.lastDirty.rects,
          });
        } catch {
          /* ignore patch errors */
        }
      }
      this.ctx.source.onFrame(i420Frame);
      this.metrics.markSent();
      this.prevRgba = new Uint8Array(buf.rgba);
    } catch {
      this.metrics.markDropped();
    }
  }
}
