import { ipcMain } from 'electron';
import { readEnvFile, validateEnv, writeConfigFile } from '../shared/env-file';
import { ENV_FIELDS, ENV_GROUPS } from '../shared/env-schema';
import { openConfigFolder, resolveConfigPath } from '../shared/paths';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get-schema', () => ({
    fields: ENV_FIELDS,
    groups: ENV_GROUPS,
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
    return { ok: true as const, path };
  });

  ipcMain.handle('settings:open-config-folder', () => {
    openConfigFolder();
    return { ok: true };
  });
}
