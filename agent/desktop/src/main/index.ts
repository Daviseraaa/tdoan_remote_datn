import { registerSettingsIpc } from './ipc';
import { startTrayApp } from '../tray/tray';

registerSettingsIpc();
startTrayApp();
