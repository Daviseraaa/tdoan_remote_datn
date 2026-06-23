import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('stationhubSettings', {
  getSchema: () => ipcRenderer.invoke('settings:get-schema'),
  load: () => ipcRenderer.invoke('settings:load'),
  save: (values: Record<string, string>) =>
    ipcRenderer.invoke('settings:save', values),
  openConfigFolder: () => ipcRenderer.invoke('settings:open-config-folder'),
  getStatus: () => ipcRenderer.invoke('settings:get-status'),
  getAutostart: () => ipcRenderer.invoke('settings:get-autostart'),
  setAutostart: (enabled: boolean) =>
    ipcRenderer.invoke('settings:set-autostart', enabled),
  notifySaved: () => ipcRenderer.send('settings:saved-restart'),
});
