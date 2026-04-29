import { app, Tray, Menu, nativeImage, dialog, BrowserWindow } from 'electron';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../logger';
import { ConnectionManager } from '../core/connection-manager';
import { HeartbeatService } from '../core/heartbeat';
import { TaskRunner } from '../core/task-runner';

let tray: Tray | null = null;
let logWindow: BrowserWindow | null = null;
const recentLogs: string[] = [];
const MAX_LOG_LINES = 200;

const connection = new ConnectionManager();
const heartbeat = new HeartbeatService(connection);
const taskRunner = new TaskRunner(connection);

connection.on('connected', () => {
  try {
    taskRunner.register();
    heartbeat.start();
  } catch (err) {
    logger.error({ err }, 'Failed to register task runner');
  }
  updateTrayStatus();
});
connection.on('disconnected', () => {
  heartbeat.stop();
  updateTrayStatus();
});
connection.on('state', () => updateTrayStatus());

const origInfo = logger.info.bind(logger);
const origWarn = logger.warn.bind(logger);
const origError = logger.error.bind(logger);

function captureLog(level: string, obj: unknown, msg?: string) {
  const time = new Date().toLocaleTimeString();
  const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
  const line = `[${time}] [${level.toUpperCase()}] ${msg ?? ''} ${payload}`.trim();
  recentLogs.push(line);
  if (recentLogs.length > MAX_LOG_LINES) recentLogs.shift();
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.executeJavaScript(
      `window.appendLog && window.appendLog(${JSON.stringify(line)})`,
    ).catch(() => undefined);
  }
}

logger.info = ((obj: unknown, msg?: string) => {
  captureLog('info', obj, msg);
  return origInfo(obj as never, msg as never);
}) as typeof logger.info;
logger.warn = ((obj: unknown, msg?: string) => {
  captureLog('warn', obj, msg);
  return origWarn(obj as never, msg as never);
}) as typeof logger.warn;
logger.error = ((obj: unknown, msg?: string) => {
  captureLog('error', obj, msg);
  return origError(obj as never, msg as never);
}) as typeof logger.error;

function buildMenu(): Menu {
  const state = connection.currentState;
  const statusLabel =
    state === 'connected'
      ? 'Status: Connected'
      : state === 'connecting'
      ? 'Status: Connecting...'
      : 'Status: Disconnected';

  return Menu.buildFromTemplate([
    { label: `DATN Agent v${config.agentVersion}`, enabled: false },
    { label: statusLabel, enabled: false },
    { label: `Server: ${config.serverUrl}`, enabled: false },
    { label: `Host: ${config.hostname}`, enabled: false },
    { type: 'separator' },
    {
      label: 'Reconnect',
      click: () => {
        connection.disconnect();
        setTimeout(() => connection.connect(), 500);
      },
    },
    {
      label: 'Show Logs',
      click: () => showLogWindow(),
    },
    {
      label: 'About',
      click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'DATN Agent',
          message: `DATN Remote Agent v${config.agentVersion}`,
          detail: `Host: ${config.hostname}\nServer: ${config.serverUrl}`,
        });
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        connection.disconnect();
        app.quit();
      },
    },
  ]);
}

function updateTrayStatus() {
  if (!tray) return;
  const state = connection.currentState;
  const tooltip =
    state === 'connected'
      ? `DATN Agent - Connected to ${config.serverUrl}`
      : state === 'connecting'
      ? `DATN Agent - Connecting...`
      : `DATN Agent - Disconnected`;
  tray.setToolTip(tooltip);
  tray.setContextMenu(buildMenu());
}

function createTrayIcon(): Tray {
  const iconPath = path.join(__dirname, 'icon.png');
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) {
    image = nativeImage.createEmpty();
  }
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

app.whenReady().then(() => {
  tray = createTrayIcon();
  tray.setToolTip('DATN Agent');
  tray.setContextMenu(buildMenu());
  tray.on('double-click', () => showLogWindow());

  logger.info('Tray app started');
  connection.connect();
});

app.on('window-all-closed', () => {
  // keep app alive in tray; do nothing
});

app.on('before-quit', () => {
  heartbeat.stop();
  connection.disconnect();
});
