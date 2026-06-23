import { ipcMain } from 'electron';
import { getAgentStatus } from '../shared/agent-status';
import { readEnvFile, validateEnv, writeConfigFile } from '../shared/env-file';
import {
  getAutostartPreference,
  setAutostartEnabled,
} from '../shared/login-item';
import { userVisibleEnvFields, userVisibleEnvGroups } from '../shared/env-schema';
import { openConfigFolder, resolveConfigPath } from '../shared/paths';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-schema', () => ({
    fields: userVisibleEnvFields(),
    groups: userVisibleEnvGroups(),
  }));

  ipcMain.handle('settings:load', () => {
    const path = resolveConfigPath();
    return { path, values: readEnvFile(path) };
  });

  ipcMain.handle('settings:save', (_e, values: Record<string, string>) => {
    const validation = validateEnv(values);
    if (!validation.ok) {
      return { ok: false as const, errors: validation.errors };
    }
    const path = writeConfigFile(values);
    return { ok: true as const, path, values: readEnvFile(path) };
  });

  ipcMain.handle('settings:open-config-folder', () => {
    openConfigFolder();
    return { ok: true };
  });

  ipcMain.handle('settings:get-status', () => getAgentStatus());

  ipcMain.handle('settings:get-autostart', () => ({
    enabled: getAutostartPreference(),
  }));

  ipcMain.handle('settings:set-autostart', (_e, enabled: boolean) => {
    try {
      const want = Boolean(enabled);
      setAutostartEnabled(want);
      return { ok: true as const, enabled: getAutostartPreference() };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  });
}
