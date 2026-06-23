import { app } from 'electron';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ensureProgramDataDir } from './paths';

/** Tên value trong HKCU\\...\\Run — hiển thị trên Settings → Startup. */
export const AUTOSTART_REGISTRY_NAME = 'StationHub Agent';

const WIN_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const WIN_STARTUP_APPROVED_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run';

const PREF_FILE = () => {
  const pd = process.env.ProgramData || path.join('C:', 'ProgramData');
  return path.join(pd, 'StationHub', 'autostart.json');
};

type AutostartPref = { enabled: boolean };

function readPref(): AutostartPref | null {
  try {
    const raw = fs.readFileSync(PREF_FILE(), 'utf8');
    const parsed = JSON.parse(raw) as AutostartPref;
    if (typeof parsed.enabled === 'boolean') return parsed;
  } catch {
    /* chưa có hoặc hỏng */
  }
  return null;
}

function writePref(enabled: boolean): void {
  ensureProgramDataDir();
  fs.writeFileSync(PREF_FILE(), JSON.stringify({ enabled }, null, 2), 'utf8');
}

function autostartExecutable(): string {
  try {
    return app.getPath('exe');
  } catch {
    return process.execPath;
  }
}

function loginItemSettings(openAtLogin: boolean) {
  return {
    openAtLogin,
    path: autostartExecutable(),
    args: [] as string[],
    name: AUTOSTART_REGISTRY_NAME,
  };
}

function normalizeExePath(p: string): string {
  return path.normalize(p.replace(/^"(.*)"$/, '$1')).toLowerCase();
}

function parseRegQuerySz(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    if (!line.includes('REG_SZ')) continue;
    const idx = line.indexOf('REG_SZ');
    const val = line.slice(idx + 'REG_SZ'.length).trim();
    if (val) return val;
  }
  return null;
}

function winRegQueryValue(valueName: string): string | null {
  try {
    const out = execFileSync('reg', ['query', WIN_RUN_KEY, '/v', valueName], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return parseRegQuerySz(out);
  } catch {
    return null;
  }
}

function winRunEntryMatchesExe(valueName: string): boolean {
  const raw = winRegQueryValue(valueName);
  if (!raw) return false;
  return normalizeExePath(raw) === normalizeExePath(autostartExecutable());
}

/** Đọc trạng thái thật từ registry / Electron (không dùng file pref). */
function readOsAutostartEnabled(): boolean {
  if (process.platform === 'win32') {
    if (winRunEntryMatchesExe(AUTOSTART_REGISTRY_NAME)) return true;
    const exeName = path.basename(autostartExecutable(), '.exe');
    if (exeName !== AUTOSTART_REGISTRY_NAME && winRunEntryMatchesExe(exeName)) {
      return true;
    }
    return false;
  }
  return app.getLoginItemSettings(loginItemSettings(false)).openAtLogin;
}

function winRegDeleteValue(valueName: string): void {
  try {
    execFileSync('reg', ['delete', WIN_RUN_KEY, '/v', valueName, '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    /* không tồn tại */
  }
  winClearStartupApproved(valueName);
}

function winClearStartupApproved(valueName: string): void {
  try {
    execFileSync(
      'reg',
      ['delete', WIN_STARTUP_APPROVED_KEY, '/v', valueName, '/f'],
      { stdio: 'ignore', windowsHide: true },
    );
  } catch {
    /* không tồn tại */
  }
}

function winRegSetRun(enabled: boolean): void {
  if (enabled) {
    const exe = autostartExecutable();
    const data = exe.includes(' ') ? `"${exe}"` : exe;
    execFileSync(
      'reg',
      [
        'add',
        WIN_RUN_KEY,
        '/v',
        AUTOSTART_REGISTRY_NAME,
        '/t',
        'REG_SZ',
        '/d',
        data,
        '/f',
      ],
      { windowsHide: true },
    );
    // Gỡ trạng thái "disabled" do Task Manager — không xóa Run key.
    winClearStartupApproved(AUTOSTART_REGISTRY_NAME);
  } else {
    winRegDeleteValue(AUTOSTART_REGISTRY_NAME);
    winRegDeleteValue(path.basename(autostartExecutable(), '.exe'));
  }
}

function applyOsAutostart(enabled: boolean): void {
  if (process.platform === 'win32') {
    if (enabled) {
      removeStaleAutostartRunValues();
    }
    winRegSetRun(enabled);
    try {
      app.setLoginItemSettings(
        enabled ? loginItemSettings(true) : { openAtLogin: false },
      );
    } catch {
      /* Electron có thể fail khi dev — registry là nguồn chính trên Windows */
    }
    return;
  }
  app.setLoginItemSettings(loginItemSettings(enabled));
}

/** Gỡ entry dev Electron / tên package cũ khỏi Run (tránh trùng Startup). */
export function removeStaleAutostartRunValues(): void {
  if (process.platform !== 'win32') return;
  for (const stale of ['Electron', 'stationhub-agent-desktop', AUTOSTART_REGISTRY_NAME]) {
    winRegDeleteValue(stale);
  }
}

/** Pref user (nếu có), không thì đọc OS. */
export function getAutostartPreference(): boolean {
  const pref = readPref();
  if (pref !== null) return pref.enabled;
  return readOsAutostartEnabled();
}

/** Tray tự chạy khi user đăng nhập Windows (Startup / Login item). */
export function isAutostartEnabled(): boolean {
  return getAutostartPreference();
}

export function setAutostartEnabled(enabled: boolean): void {
  writePref(enabled);
  if (enabled) {
    removeStaleAutostartRunValues();
  }
  applyOsAutostart(enabled);
}

/** Mặc định bật lần đầu; sau đó theo file pref (user toggle). */
export function ensureDefaultAutostart(): void {
  const pref = readPref();
  const want = pref?.enabled ?? true;
  if (readOsAutostartEnabled() !== want) {
    applyOsAutostart(want);
  }
  if (pref === null) {
    writePref(want);
  }
}
