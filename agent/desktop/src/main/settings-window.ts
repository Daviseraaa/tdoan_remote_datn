import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { resolveAppIconPath } from '../shared/app-icon';

let settingsWindow: BrowserWindow | null = null;

export function showSettingsWindow(onSaved?: () => void): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const iconPath = resolveAppIconPath();
  settingsWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    title: 'StationHub Agent',
    backgroundColor: '#06080f',
    autoHideMenuBar: true,
    ...(iconPath ? { icon: iconPath } : {}),
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
