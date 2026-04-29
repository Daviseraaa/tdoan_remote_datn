import { logger } from '../logger';
import { RealtimeMetrics } from './realtime-metrics';
import { SoftwareVideoPipeline } from './software-video-pipeline';
import { EncodeTarget, PipelineContext, VideoPipeline, VideoPipelineStats } from './video-pipeline';
import { probeFfmpeg } from './native-encoder/ffmpeg-probe';
import { FfmpegSession } from './native-encoder/ffmpeg-session';

type H264Preferred = 'auto' | 'nvenc' | 'amf' | 'qsv';

export interface FfmpegVideoPipelineOptions {
  ffmpegPath: string;
  preferredEncoder: H264Preferred;
  keyint: number;
  preset: string;
}

export class FfmpegVideoPipeline implements VideoPipeline {
  readonly name = 'ffmpeg' as const;

  private readonly fallback: SoftwareVideoPipeline;
  private ffmpegSession: FfmpegSession | null = null;
  private usingFallback = false;
  private target: EncodeTarget;
  private stats: VideoPipelineStats = {};

  constructor(
    private readonly ctx: PipelineContext,
    private readonly metrics: RealtimeMetrics,
    initialTarget: EncodeTarget,
    private readonly options: FfmpegVideoPipelineOptions,
  ) {
    this.target = initialTarget;
    this.fallback = new SoftwareVideoPipeline(ctx, metrics, initialTarget);
  }

  async start(): Promise<void> {
    const probe = await probeFfmpeg(this.options.ffmpegPath);
    if (!probe.available) {
      this.usingFallback = true;
      await this.fallback.start();
      return;
    }

    const encoder = chooseEncoder(this.options.preferredEncoder, probe.encoders);
    if (!encoder) {
      this.usingFallback = true;
      await this.fallback.start();
      return;
    }

    this.ffmpegSession = new FfmpegSession({
      ffmpegPath: this.options.ffmpegPath,
      encoder,
      fps: this.target.fps,
      bitrateKbps: this.target.bitrateKbps,
      keyint: this.options.keyint,
      preset: this.options.preset,
    });
    this.ffmpegSession.start();
    // Current wrtc path still needs raw frames; keep software sender active.
    await this.fallback.start();
    logger.info({ encoder }, 'ffmpeg hardware session started, software sender active');
  }

  async stop(): Promise<void> {
    this.ffmpegSession?.stop();
    this.ffmpegSession = null;
    await this.fallback.stop();
  }

  updateTarget(target: EncodeTarget): void {
    this.target = target;
    this.fallback.updateTarget(target);
    if (this.ffmpegSession) {
      // Soft-apply in this phase: session keeps running; full dynamic reconfigure in next phase.
      this.stats.keyframeInterval = Math.max(10, this.options.keyint);
    }
  }

  getStats(): VideoPipelineStats {
    if (this.ffmpegSession) {
      const sess = this.ffmpegSession.stats;
      this.stats.restartCount = sess.restartCount;
    }
    return {
      ...this.stats,
      ...this.fallback.getStats(),
    };
  }
}

function chooseEncoder(preferred: H264Preferred, supported: string[]): 'h264_nvenc' | 'h264_amf' | 'h264_qsv' | 'libx264' | null {
  const ordered =
    preferred === 'nvenc'
      ? ['h264_nvenc', 'h264_amf', 'h264_qsv', 'libx264']
      : preferred === 'amf'
        ? ['h264_amf', 'h264_nvenc', 'h264_qsv', 'libx264']
        : preferred === 'qsv'
          ? ['h264_qsv', 'h264_nvenc', 'h264_amf', 'libx264']
          : ['h264_nvenc', 'h264_amf', 'h264_qsv', 'libx264'];
  for (const name of ordered) {
    if (supported.includes(name)) {
      return name as 'h264_nvenc' | 'h264_amf' | 'h264_qsv' | 'libx264';
    }
  }
  return null;
}
