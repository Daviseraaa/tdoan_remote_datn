import { app, Tray, Menu, nativeImage, dialog, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { loadDesktopConfig } from '../shared/config';
import { getLogger } from '../shared/logger';
import {
  agentRoot,
  ensureChromeScriptsDir,
  openConfigFolder,
  resolveChromeScriptsDir,
  resolveCloakRunnerDir,
  resolveCloakRunnerScript,
  resolveConfigPath,
  resolveCoreExe,
} from '../shared/paths';
import { showSettingsWindow } from '../main/settings-window';
import { installDatnNativeWindowsService, NATIVE_SVC_NAME } from '../service/native-windows-service';
import { uninstallDatnNativeWindowsService } from '../service/native-windows-service';

const logger = getLogger();

let tray: Tray | null = null;
let logWindow: BrowserWindow | null = null;
const recentLogs: string[] = [];
const MAX_LOG_LINES = 200;

let rustAgent: ChildProcess | null = null;

export function restartRustAgent(): void {
  if (rustAgent && !rustAgent.killed) {
    rustAgent.kill('SIGTERM');
  }
  setTimeout(() => startRustAgent(), 500);
}

function pushLog(level: string, msg: string) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] [${level}] ${msg}`.trim();
  recentLogs.push(line);
  if (recentLogs.length > MAX_LOG_LINES) recentLogs.shift();
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents
      .executeJavaScript(
        `window.appendLog && window.appendLog(${JSON.stringify(line)})`,
      )
      .catch(() => undefined);
  }
}

export function startRustAgent() {
  const exe = resolveCoreExe();
  if (!fs.existsSync(exe)) {
    pushLog('ERROR', `Thiếu ${exe} — chạy npm run build:core từ thư mục agent/`);
    return;
  }
  if (rustAgent && rustAgent.exitCode === null && !rustAgent.killed) {
    return;
  }
  const root = agentRoot();
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATN_AGENT_ROOT: root,
    RUST_LOG: process.env.RUST_LOG ?? 'info',
  };
  const cloakScript = resolveCloakRunnerScript();
  if (cloakScript) childEnv.CLOAK_RUNNER_SCRIPT = cloakScript;
  const cloakDir = resolveCloakRunnerDir();
  if (cloakDir) childEnv.CLOAK_RUNNER_DIR = cloakDir;

  const child = spawn(exe, ['agent'], {
    env: childEnv,
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  rustAgent = child;
  const onChunk = (buf: Buffer, level: 'INFO' | 'ERROR' = 'INFO') => {
    const s = buf.toString('utf8').trim();
    if (!s) return;
    for (const line of s.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const isErr =
        level === 'ERROR' ||
        /panic|error|THẤT BẠI|failed|lỗi/i.test(trimmed);
      pushLog(isErr ? 'ERROR' : 'INFO', trimmed);
    }
  };
  child.stdout?.on('data', (buf) => onChunk(buf, 'INFO'));
  child.stderr?.on('data', (buf) => onChunk(buf, 'ERROR'));
  child.on('exit', (code, signal) => {
    rustAgent = null;
    pushLog('WARN', `Rust agent thoát code=${code} signal=${signal ?? ''}`);
    updateTrayStatus();
  });
  logger.info({ exe }, 'Rust agent started');
  pushLog('INFO', 'Rust agent đã khởi động');
  updateTrayStatus();
}

function listLocalChromeScripts(): { name: string; path: string }[] {
  try {
    const dir = ensureChromeScriptsDir();
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ name: f.replace(/\.json$/i, ''), path: path.join(dir, f) }))
      .sort((a, b) => b.path.localeCompare(a.path));
  } catch {
    return [];
  }
}

function openChromeScriptsFolder(): void {
  const dir = ensureChromeScriptsDir();
  const { shell } = require('electron') as typeof import('electron');
  shell.openPath(dir).catch(() => undefined);
}

function runChromeReplay(scriptPath: string): void {
  const exe = resolveCoreExe();
  if (!fs.existsSync(exe)) {
    dialog.showErrorBox('Replay', `Thiếu ${exe}`);
    return;
  }
  try {
    const out = execFileSync(exe, ['chrome-replay', scriptPath], {
      encoding: 'utf8',
      timeout: 600_000,
      windowsHide: true,
    });
    dialog.showMessageBox({
      type: 'info',
      title: 'Chrome replay',
      message: 'Chạy lại script xong',
      detail: out.length > 3500 ? `${out.slice(0, 3500)}…` : out,
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    dialog.showErrorBox(
      'Replay lỗi',
      [err.stderr, err.stdout, err.message].filter(Boolean).join('\n') || String(e),
    );
  }
}

function buildChromeScriptsSubmenu(): Electron.MenuItemConstructorOptions[] {
  const scripts = listLocalChromeScripts();
  const items: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Mở thư mục script',
      click: () => openChromeScriptsFolder(),
    },
  ];
  if (scripts.length === 0) {
    items.push({
      label: `(trống — ${resolveChromeScriptsDir()})`,
      enabled: false,
    });
    return items;
  }
  items.push({ type: 'separator' });
  for (const s of scripts.slice(0, 12)) {
    items.push({
      label: s.name,
      submenu: [
        {
          label: 'Chạy lại',
          click: () => runChromeReplay(s.path),
        },
      ],
    });
  }
  if (scripts.length > 12) {
    items.push({ label: `… và ${scripts.length - 12} file khác`, enabled: false });
  }
  return items;
}

function buildMenu(): Menu {
  const cfg = loadDesktopConfig();
  const running = rustAgent && rustAgent.exitCode === null && !rustAgent.killed;
  const statusLabel = running
    ? 'Agent: Rust (đang chạy)'
    : 'Agent: Rust (đã dừng / lỗi)';

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: `DATN Agent v${cfg.agentVersion}`, enabled: false },
    { label: statusLabel, enabled: false },
    { label: `Server: ${cfg.serverUrl}`, enabled: false },
    { label: `Host: ${cfg.hostname}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Cài đặt…',
      click: () => showSettingsWindow(() => restartRustAgent()),
    },
    {
      label: 'Khởi động lại agent',
      click: () => restartRustAgent(),
    },
    { label: 'Show Logs', click: () => showLogWindow() },
    {
      label: 'Mở thư mục config',
      click: () => openConfigFolder(),
    },
    {
      label: 'Chrome scripts',
      submenu: buildChromeScriptsSubmenu(),
    },
    { type: 'separator' },
  ];

  if (process.platform === 'win32') {
    template.push(
      {
        label: 'Cài Windows Service',
        click: () => {
          try {
            installDatnNativeWindowsService();
            execFileSync('sc', ['start', NATIVE_SVC_NAME], { stdio: 'inherit' });
            dialog.showMessageBox({
              type: 'info',
              title: 'Service',
              message: `Đã cài và start ${NATIVE_SVC_NAME}`,
            });
          } catch (e) {
            dialog.showErrorBox('Lỗi cài service', String(e));
          }
        },
      },
      {
        label: 'Gỡ Windows Service',
        click: () => {
          uninstallDatnNativeWindowsService();
          dialog.showMessageBox({
            type: 'info',
            title: 'Service',
            message: 'Đã gỡ service (nếu có).',
          });
        },
      },
      { type: 'separator' },
    );
  }

  template.push(
    {
      label: 'About',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'DATN Agent',
          message: `DATN Agent v${cfg.agentVersion}`,
          detail: `Host: ${cfg.hostname}\nServer: ${cfg.serverUrl}\nConfig: ${resolveConfigPath()}\nCore: ${resolveCoreExe()}`,
        });
      },
    },
    {
      label: 'Quit',
      click: () => {
        if (rustAgent && !rustAgent.killed) rustAgent.kill('SIGTERM');
        app.quit();
      },
    },
  );

  return Menu.buildFromTemplate(template);
}

function updateTrayStatus() {
  if (!tray) return;
  const cfg = loadDesktopConfig();
  const running = rustAgent && rustAgent.exitCode === null && !rustAgent.killed;
  tray.setToolTip(
    running
      ? `DATN Agent (Rust) — ${cfg.serverUrl}`
      : `DATN Agent — đã dừng`,
  );
  tray.setContextMenu(buildMenu());
}

function createTrayIcon(): Tray {
  const iconPath = path.join(__dirname, 'icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) image = nativeImage.createEmpty();
  return new Tray(image);
}

function showLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    logWindow.focus();
    return;
  }
  logWindow = new BrowserWindow({
    width: 800,
    height: 500,
    title: 'DATN Agent - Logs',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>DATN Agent Logs</title>
<style>body{font-family:Consolas,monospace;background:#1e1e1e;color:#d4d4d4;margin:0;padding:8px;font-size:12px;}
#log{white-space:pre-wrap;}</style></head><body><div id="log"></div>
<script>
const el = document.getElementById('log');
window.appendLog = (line) => {
  el.textContent += line + '\\n';
  window.scrollTo(0, document.body.scrollHeight);
};
window.appendLog(${JSON.stringify(recentLogs.join('\n'))});
</script></body></html>`;
  logWindow.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(html),
  );
  logWindow.on('closed', () => {
    logWindow = null;
  });
}

export function startTrayApp(): void {
  app.whenReady().then(() => {
    tray = createTrayIcon();
    tray.setToolTip('DATN Agent');
    tray.setContextMenu(buildMenu());
    tray.on('double-click', () => showLogWindow());
    startRustAgent();
  });

  app.on('window-all-closed', () => {
    /* tray */
  });

  app.on('before-quit', () => {
    if (rustAgent && !rustAgent.killed) rustAgent.kill('SIGTERM');
  });
}
