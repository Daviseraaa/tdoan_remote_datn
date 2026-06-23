import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Thư mục gốc package `agent/` (dev) hoặc thư mục cài đặt (packaged). */
export function agentRoot(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    if (app?.isPackaged) {
      return path.dirname(process.execPath);
    }
  } catch {
    /* không trong electron */
  }
  // dist/main/paths.js -> agent/desktop/dist/main -> agent/desktop -> agent
  return path.resolve(__dirname, '..', '..', '..');
}

export function programDataConfigPath(): string {
  const pd = process.env.ProgramData || path.join('C:', 'ProgramData');
  return path.join(pd, 'StationHub', 'agent.env');
}

export function programDataStationHubDir(): string {
  return path.dirname(programDataConfigPath());
}

/** Ghi đường dẫn core đang chạy — Desktop Recorder dùng khi «Chạy lại». */
export function writeAgentCorePointer(exePath: string): void {
  const dir = programDataStationHubDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'agent-core.path'), exePath, 'utf8');
}

/** File config đang dùng / nơi ghi mặc định. */
export function resolveConfigPath(): string {
  if (process.env.STATIONHUB_AGENT_CONFIG?.trim()) {
    return process.env.STATIONHUB_AGENT_CONFIG.trim();
  }
  const pd = programDataConfigPath();
  if (fs.existsSync(pd)) return pd;
  const dev = path.join(agentRoot(), '.env');
  if (fs.existsSync(dev)) return dev;
  return pd;
}

export function resolveCloakRunnerScript(): string | null {
  const p = path.join(agentRoot(), 'cloak-runner', 'main.py');
  return fs.existsSync(p) ? p : null;
}

export function resolveCloakRunnerDir(): string | null {
  const dir = path.join(agentRoot(), 'bin', 'cloak');
  const exe = path.join(dir, 'stationhub-cloak-runner.exe');
  return fs.existsSync(exe) ? dir : null;
}

export function resolveCoreExe(): string {
  try {
    const { app } = require('electron') as typeof import('electron');
    if (app?.isPackaged) {
      const packaged = path.join(
        process.resourcesPath,
        'core',
        'stationhub-agent-native.exe',
      );
      if (fs.existsSync(packaged)) return packaged;
    }
  } catch {
    /* cli */
  }
  return path.join(agentRoot(), 'bin', 'stationhub-agent-native.exe');
}

export function resolveChromeScriptsDir(): string {
  const pd = process.env.ProgramData || path.join('C:', 'ProgramData');
  return path.join(pd, 'StationHub', 'chrome-scripts');
}

export function ensureProgramDataDir(): void {
  const dir = path.dirname(programDataConfigPath());
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureChromeScriptsDir(): string {
  const dir = resolveChromeScriptsDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function openConfigFolder(): void {
  const p = resolveConfigPath();
  const dir = fs.existsSync(p) ? path.dirname(p) : path.dirname(programDataConfigPath());
  ensureProgramDataDir();
  const { execFile } = require('child_process') as typeof import('child_process');
  if (process.platform === 'win32') {
    execFile('explorer.exe', [dir], () => undefined);
  } else if (process.platform === 'darwin') {
    execFile('open', [dir], () => undefined);
  } else {
    execFile('xdg-open', [dir], () => undefined);
  }
}

export function hostInfo() {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
  };
}
