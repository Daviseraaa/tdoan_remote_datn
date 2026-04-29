import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

type Scenario = {
  name: string;
  env: Record<string, string>;
};

type TelemetryPoint = {
  rttMs?: number;
  effectiveFps?: number;
  captureMsAvg?: number;
  convertMsAvg?: number;
  patchBytes?: number;
  patchDropCount?: number;
};

type ScenarioResult = {
  name: string;
  durationSec: number;
  samples: {
    telemetryCount: number;
    cpuCount: number;
  };
  p95: {
    cpuPercent?: number;
    rttMs?: number;
    effectiveFps?: number;
    captureMsAvg?: number;
    convertMsAvg?: number;
    frameLatencyMs?: number;
    patchBytes?: number;
    patchDropCount?: number;
  };
  notes: string[];
};

const DEFAULT_DURATION_SEC = numberArg('--durationSec', 90);
const DEFAULT_OUTPUT_DIR = strArg('--outputDir', path.join(process.cwd(), 'benchmark-results'));
const COMMAND = strArg('--command', 'npm run start:dev');
const MATRIX = strArg('--matrix', 'default');

const SCENARIOS: Record<string, Scenario[]> = {
  default: [
    {
      name: 'wrtc-software-baseline',
      env: {
        REMOTE_MEDIA_ENGINE: 'wrtc',
        REMOTE_VIDEO_PIPELINE: 'software',
        REMOTE_ADAPTIVE_ENABLED: 'false',
      },
    },
    {
      name: 'wrtc-ffmpeg',
      env: {
        REMOTE_MEDIA_ENGINE: 'wrtc',
        REMOTE_VIDEO_PIPELINE: 'ffmpeg',
        REMOTE_ADAPTIVE_ENABLED: 'true',
      },
    },
    {
      name: 'ndc-ffmpeg',
      env: {
        REMOTE_MEDIA_ENGINE: 'ndc',
        REMOTE_VIDEO_PIPELINE: 'ffmpeg',
        REMOTE_ADAPTIVE_ENABLED: 'true',
      },
    },
  ],
  phase2: [
    {
      name: 'ndc-lowlat-sg',
      env: {
        REMOTE_MEDIA_ENGINE: 'ndc',
        REMOTE_VIDEO_PIPELINE: 'ffmpeg',
        REMOTE_QUALITY_PROFILE: 'low-latency',
        REMOTE_PREFERRED_REGION: 'sg',
      },
    },
    {
      name: 'ndc-balanced-jp',
      env: {
        REMOTE_MEDIA_ENGINE: 'ndc',
        REMOTE_VIDEO_PIPELINE: 'ffmpeg',
        REMOTE_QUALITY_PROFILE: 'balanced',
        REMOTE_PREFERRED_REGION: 'jp',
      },
    },
    {
      name: 'ndc-high-us',
      env: {
        REMOTE_MEDIA_ENGINE: 'ndc',
        REMOTE_VIDEO_PIPELINE: 'ffmpeg',
        REMOTE_QUALITY_PROFILE: 'high-quality',
        REMOTE_PREFERRED_REGION: 'us',
      },
    },
  ],
  /** Tile patch DataChannel: so sánh bật/tắt (cần session remote thực tế để có telemetry đầy đủ). */
  tilepatch: [
    {
      name: 'wrtc-tilepatch-on',
      env: {
        REMOTE_MEDIA_ENGINE: 'wrtc',
        REMOTE_VIDEO_PIPELINE: 'software',
        REMOTE_TILE_PATCH_ENABLED: 'true',
        REMOTE_TILE_DIFF_ENABLED: 'true',
        REMOTE_TILE_PATCH_MAX_TILES: '48',
      },
    },
    {
      name: 'wrtc-tilepatch-off',
      env: {
        REMOTE_MEDIA_ENGINE: 'wrtc',
        REMOTE_VIDEO_PIPELINE: 'software',
        REMOTE_TILE_PATCH_ENABLED: 'false',
        REMOTE_TILE_DIFF_ENABLED: 'true',
      },
    },
  ],
};

async function main() {
  const scenarios = SCENARIOS[MATRIX];
  if (!scenarios?.length) {
    throw new Error(`Unknown matrix "${MATRIX}". Available: ${Object.keys(SCENARIOS).join(', ')}`);
  }
  fs.mkdirSync(DEFAULT_OUTPUT_DIR, { recursive: true });
  const results: ScenarioResult[] = [];

  for (const s of scenarios) {
    const res = await runScenario(s, DEFAULT_DURATION_SEC);
    results.push(res);
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(DEFAULT_OUTPUT_DIR, `benchmark-${stamp}.json`);
  const mdPath = path.join(DEFAULT_OUTPUT_DIR, `benchmark-${stamp}.md`);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        command: COMMAND,
        durationSec: DEFAULT_DURATION_SEC,
        matrix: MATRIX,
        generatedAt: now.toISOString(),
        results,
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(mdPath, renderMarkdown(results), 'utf8');

  process.stdout.write(`Benchmark done.\nJSON: ${jsonPath}\nMD: ${mdPath}\n`);
}

async function runScenario(scenario: Scenario, durationSec: number): Promise<ScenarioResult> {
  const child = spawn(COMMAND, {
    shell: true,
    env: {
      ...process.env,
      ...scenario.env,
      FORCE_COLOR: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pid = child.pid;
  if (!pid) throw new Error(`Cannot start scenario ${scenario.name}`);

  const telemetry: TelemetryPoint[] = [];
  const cpuSamples: number[] = [];
  const notes: string[] = [];
  let carry = '';
  let inTelemetryBlock = false;
  let block: Record<string, number> = {};

  const onChunk = (chunk: Buffer) => {
    carry += chunk.toString('utf8');
    let idx = carry.indexOf('\n');
    while (idx >= 0) {
      const line = carry.slice(0, idx).replace(/\r$/, '');
      carry = carry.slice(idx + 1);
      parseLine(line);
      idx = carry.indexOf('\n');
    }
  };

  const parseLine = (line: string) => {
    if (!line) {
      if (inTelemetryBlock) flushTelemetry();
      return;
    }
    if (line.includes('remote telemetry')) {
      if (inTelemetryBlock) flushTelemetry();
      inTelemetryBlock = true;
      block = {};
      return;
    }
    if (!inTelemetryBlock) return;
    const m = line.match(/^\s*([a-zA-Z0-9_]+):\s*([0-9.]+)/);
    if (m) {
      block[m[1]!] = Number(m[2]!);
      return;
    }
    if (/^\S/.test(line)) {
      flushTelemetry();
    }
  };

  const flushTelemetry = () => {
    inTelemetryBlock = false;
    telemetry.push({
      rttMs: block.rttMs,
      effectiveFps: block.effectiveFps,
      captureMsAvg: block.captureMsAvg,
      convertMsAvg: block.convertMsAvg,
      patchBytes: block.patchBytes,
      patchDropCount: block.patchDropCount,
    });
    block = {};
  };

  child.stdout.on('data', onChunk);
  child.stderr.on('data', onChunk);

  let prevCpuSec = await readProcessCpuSeconds(pid);
  const cpuTimer = setInterval(async () => {
    const cur = await readProcessCpuSeconds(pid);
    if (cur == null || prevCpuSec == null) return;
    const deltaSec = cur - prevCpuSec;
    prevCpuSec = cur;
    const cpu = Math.max(0, (deltaSec / 1) * 100 / Math.max(1, os.cpus().length));
    cpuSamples.push(cpu);
  }, 1000);

  await sleep(durationSec * 1000);

  clearInterval(cpuTimer);
  if (inTelemetryBlock) flushTelemetry();

  await killProcessTree(pid);
  await onceExit(child, 5000);

  if (telemetry.length === 0) {
    notes.push('No remote telemetry samples captured. Start a live remote session while benchmark runs.');
  }
  if (cpuSamples.length === 0) {
    notes.push('No CPU samples captured.');
  }

  const rttValues = telemetry.map((t) => t.rttMs).filter(isNum);
  const fpsValues = telemetry.map((t) => t.effectiveFps).filter(isNum);
  const capValues = telemetry.map((t) => t.captureMsAvg).filter(isNum);
  const convValues = telemetry.map((t) => t.convertMsAvg).filter(isNum);

  const frameLatencyValues = capValues
    .map((v, i) => v + (convValues[i] ?? 0))
    .filter(isNum);
  const patchByteVals = telemetry.map((t) => t.patchBytes).filter(isNum);
  const patchDropVals = telemetry.map((t) => t.patchDropCount).filter(isNum);

  return {
    name: scenario.name,
    durationSec,
    samples: {
      telemetryCount: telemetry.length,
      cpuCount: cpuSamples.length,
    },
    p95: {
      cpuPercent: p95(cpuSamples),
      rttMs: p95(rttValues),
      effectiveFps: p95(fpsValues),
      captureMsAvg: p95(capValues),
      convertMsAvg: p95(convValues),
      frameLatencyMs: p95(frameLatencyValues),
      patchBytes: p95(patchByteVals),
      patchDropCount: p95(patchDropVals),
    },
    notes,
  };
}

function renderMarkdown(results: ScenarioResult[]): string {
  const lines: string[] = [];
  lines.push('# Realtime Benchmark Report');
  lines.push('');
  lines.push(`- Command: \`${COMMAND}\``);
  lines.push(`- Duration each scenario: ${DEFAULT_DURATION_SEC}s`);
  lines.push(`- Matrix: ${MATRIX}`);
  lines.push('');
  lines.push(
    '| Scenario | p95 CPU % | p95 RTT ms | p95 FPS | p95 frameLatency ms | p95 patch bytes | p95 patch drops | Telemetry samples |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of results) {
    lines.push(
      `| ${r.name} | ${fmt(r.p95.cpuPercent)} | ${fmt(r.p95.rttMs)} | ${fmt(r.p95.effectiveFps)} | ${fmt(r.p95.frameLatencyMs)} | ${fmt(r.p95.patchBytes)} | ${fmt(r.p95.patchDropCount)} | ${r.samples.telemetryCount} |`,
    );
  }
  lines.push('');
  for (const r of results) {
    if (!r.notes.length) continue;
    lines.push(`## Notes - ${r.name}`);
    for (const n of r.notes) lines.push(`- ${n}`);
    lines.push('');
  }
  return lines.join('\n');
}

function fmt(n?: number): string {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : '-';
}

function p95(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function isNum(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function onceExit(child: ReturnType<typeof spawn>, timeoutMs = 30000): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(), timeoutMs);
    child.once('exit', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

function killProcessTree(pid: number): Promise<void> {
  return new Promise((resolve) => {
    const killer = spawn('cmd', ['/c', `taskkill /PID ${pid} /T /F`], {
      stdio: 'ignore',
      windowsHide: true,
    });
    killer.once('exit', () => resolve());
  });
}

async function readProcessCpuSeconds(pid: number): Promise<number | null> {
  const ps = spawn(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CPU)`,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
  );
  let out = '';
  ps.stdout.on('data', (d) => (out += String(d)));
  await onceExit(ps);
  const v = Number(out.trim());
  return Number.isFinite(v) ? v : null;
}

function strArg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return fallback;
  return String(process.argv[i + 1]);
}

function numberArg(name: string, fallback: number): number {
  const raw = strArg(name, String(fallback));
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

main().catch((err) => {
  process.stderr.write(`${err?.stack || err}\n`);
  process.exit(1);
});
