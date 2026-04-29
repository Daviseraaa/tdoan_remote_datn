import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { logger } from '../../logger';
import { profileFor } from './ffmpeg-profiles';

export interface FfmpegSessionOptions {
  ffmpegPath: string;
  encoder: 'h264_nvenc' | 'h264_amf' | 'h264_qsv' | 'libx264';
  fps: number;
  bitrateKbps: number;
  keyint: number;
  preset: string;
  captureInput?: 'desktop' | 'test';
  width?: number;
  height?: number;
  output?: 'null' | 'h264';
  onChunk?: (chunk: Buffer) => void;
  onExit?: (code: number | null, err: string) => void;
  qualityProfile?: 'low-latency' | 'balanced' | 'high-quality';
}

export class FfmpegSession {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private restartCount = 0;
  private running = false;
  private lastErr = '';

  constructor(private readonly options: FfmpegSessionOptions) {}

  get stats() {
    return {
      restartCount: this.restartCount,
      lastErr: this.lastErr,
      running: this.running,
    };
  }

  start() {
    if (this.proc) return;
    const profile = profileFor(
      this.options.encoder,
      this.options.bitrateKbps,
      this.options.keyint,
      this.options.preset,
    );

    const args = this.buildArgs(profile.args);

    const child = spawn(this.options.ffmpegPath, args, { windowsHide: true });
    this.proc = child;
    this.running = true;

    child.stderr.on('data', (d) => {
      this.lastErr = String(d);
    });
    if (this.options.output === 'h264' && this.options.onChunk) {
      child.stdout.on('data', (d) => {
        this.options.onChunk?.(d as Buffer);
      });
    }
    child.on('error', (err) => {
      this.lastErr = String(err);
      this.running = false;
      this.proc = null;
      this.options.onExit?.(null, this.lastErr);
    });
    child.on('close', (code) => {
      this.running = false;
      this.proc = null;
      if (code !== 0) {
        this.restartCount++;
        logger.warn({ code, err: this.lastErr }, 'ffmpeg session exited unexpectedly');
      }
      this.options.onExit?.(code, this.lastErr);
    });
  }

  stop() {
    if (!this.proc) return;
    try {
      this.proc.kill();
    } catch {
      // ignore
    }
    this.proc = null;
    this.running = false;
  }

  private buildArgs(encoderArgs: string[]): string[] {
    const fps = Math.max(1, this.options.fps);
    const width = Math.max(640, this.options.width ?? 1280);
    const height = Math.max(360, this.options.height ?? 720);
    const captureInput = this.options.captureInput ?? 'desktop';
    const output = this.options.output ?? 'null';
    const base = ['-hide_banner', '-loglevel', 'error'];

    if (captureInput === 'desktop') {
      base.push(
        '-f',
        'gdigrab',
        '-framerate',
        String(fps),
        '-video_size',
        `${width}x${height}`,
        '-i',
        'desktop',
      );
    } else {
      base.push(
        '-f',
        'lavfi',
        '-i',
        `color=c=black:s=${width}x${height}:r=${fps}`,
      );
    }

    base.push(...encoderArgs, '-pix_fmt', 'yuv420p', '-tune', 'zerolatency');

    if (output === 'h264') {
      base.push('-f', 'h264', '-');
    } else {
      base.push('-f', 'null', '-');
    }
    return base;
  }
}
