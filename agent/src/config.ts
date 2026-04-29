import 'dotenv/config';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

export const config = {
  serverUrl: optional('SERVER_WS_URL', 'ws://localhost:3000'),
  agentKey: required('AGENT_KEY'),
  heartbeatIntervalMs: numberEnv('HEARTBEAT_INTERVAL_MS', 30_000),
  commandTimeoutMs: numberEnv('COMMAND_TIMEOUT_MS', 300_000),
  maxOutputBytes: numberEnv('MAX_OUTPUT_BYTES', 1_000_000),
  defaultShell: (optional('DEFAULT_SHELL', 'powershell') as
    | 'powershell'
    | 'cmd'),
  logLevel: optional('LOG_LEVEL', 'info'),
  agentVersion: '1.0.0',
  hostname: os.hostname(),
  platform: os.platform(),
  arch: os.arch(),
  cpuCount: os.cpus().length,
  totalMemory: os.totalmem(),
  osRelease: os.release(),
  remote: {
    dataChannelEnabled: boolEnv('REMOTE_DATACHANNEL_ENABLED', true),
    adaptiveEnabled: boolEnv('REMOTE_ADAPTIVE_ENABLED', true),
    telemetryEnabled: boolEnv('REMOTE_TELEMETRY_ENABLED', true),
    telemetryIntervalMs: numberEnv('REMOTE_TELEMETRY_INTERVAL_MS', 10_000),
    targetFps: numberEnv('REMOTE_TARGET_FPS', 10),
    minFps: numberEnv('REMOTE_MIN_FPS', 3),
    maxFps: numberEnv('REMOTE_MAX_FPS', 20),
    fpsStep: numberEnv('REMOTE_FPS_STEP', 2),
    adaptiveCooldownMs: numberEnv('REMOTE_ADAPTIVE_COOLDOWN_MS', 4_000),
    goodRttMs: numberEnv('REMOTE_GOOD_RTT_MS', 80),
    badRttMs: numberEnv('REMOTE_BAD_RTT_MS', 200),
    goodLoss: Number(optional('REMOTE_GOOD_LOSS', '0.01')),
    badLoss: Number(optional('REMOTE_BAD_LOSS', '0.05')),
    screenCacheMs: numberEnv('REMOTE_SCREEN_CACHE_MS', 5_000),
    videoPipeline: optional('REMOTE_VIDEO_PIPELINE', 'software') as
      | 'software'
      | 'ffmpeg',
    mediaEngine: optional('REMOTE_MEDIA_ENGINE', 'wrtc') as
      | 'wrtc'
      | 'ndc',
    ffmpegPath: optional('REMOTE_FFMPEG_PATH', 'ffmpeg'),
    h264PreferredEncoder: optional('REMOTE_H264_PREFERRED_ENCODER', 'auto') as
      | 'auto'
      | 'nvenc'
      | 'amf'
      | 'qsv',
    h264MinBitrateKbps: numberEnv('REMOTE_H264_MIN_BITRATE_KBPS', 800),
    h264MaxBitrateKbps: numberEnv('REMOTE_H264_MAX_BITRATE_KBPS', 4500),
    h264BitrateStepKbps: numberEnv('REMOTE_H264_BITRATE_STEP_KBPS', 300),
    h264Keyint: numberEnv('REMOTE_H264_KEYINT', 60),
    h264Preset: optional('REMOTE_H264_PRESET', 'p4'),
    scaleMin: Number(optional('REMOTE_SCALE_MIN', '0.5')),
    scaleMax: Number(optional('REMOTE_SCALE_MAX', '1.0')),
    scaleStep: Number(optional('REMOTE_SCALE_STEP', '0.1')),
    qualityProfile: optional('REMOTE_QUALITY_PROFILE', 'balanced') as
      | 'low-latency'
      | 'balanced'
      | 'high-quality',
    preferredRegion: optional('REMOTE_PREFERRED_REGION', ''),
    tileDiffEnabled: boolEnv('REMOTE_TILE_DIFF_ENABLED', true),
    tileSize: numberEnv('REMOTE_TILE_SIZE', 64),
    tileDiffThreshold: Number(optional('REMOTE_TILE_DIFF_THRESHOLD', '22')),
    /** RAW RGBA tile patches over DataChannel `tilepatch` (software+wrtc only) */
    tilePatchEnabled: boolEnv('REMOTE_TILE_PATCH_ENABLED', true),
    tilePatchMaxTilesPerFrame: numberEnv('REMOTE_TILE_PATCH_MAX_TILES', 48),
    tilePatchMaxBytesPerSec: numberEnv('REMOTE_TILE_PATCH_MAX_BYTES_PER_SEC', 1_500_000),
  },
};
