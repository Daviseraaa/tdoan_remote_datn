import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('datnSettings', {
  getSchema: () => ipcRenderer.invoke('settings:get-schema'),
  load: () => ipcRenderer.invoke('settings:load'),
  save: (values: Record<string, string>) =>
    ipcRenderer.invoke('settings:save', values),
  openConfigFolder: () => ipcRenderer.invoke('settings:open-config-folder'),
  notifySaved: () => ipcRenderer.send('settings:saved-restart'),
});
