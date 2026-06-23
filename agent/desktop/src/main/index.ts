import { app } from 'electron';
import { registerSettingsIpc } from './ipc';
import { showSettingsWindow } from './settings-window';
import { startTrayApp } from '../tray/tray';

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  registerSettingsIpc();

  app.on('second-instance', () => {
    const open = () => showSettingsWindow();
    if (app.isReady()) {
      open();
    } else {
      app.whenReady().then(open);
    }
  });

  startTrayApp();
}
