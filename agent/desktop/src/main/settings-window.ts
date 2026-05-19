import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let settingsWindow: BrowserWindow | null = null;

export function showSettingsWindow(onSaved?: () => void): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 640,
    height: 720,
    title: 'DATN Agent — Cài đặt',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (onSaved) {
    const handler = () => {
      onSaved();
    };
    ipcMain.once('settings:saved-restart', handler);
  }

  settingsWindow.loadFile(
    path.join(__dirname, '..', 'renderer', 'settings.html'),
  );

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}
