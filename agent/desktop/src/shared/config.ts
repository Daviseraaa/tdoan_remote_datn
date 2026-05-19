import * as os from 'os';
import { readEnvFile } from './env-file';
import { resolveConfigPath } from './paths';

export interface DesktopConfigView {
  serverUrl: string;
  agentKey: string;
  logLevel: string;
  agentVersion: string;
  hostname: string;
  configPath: string;
}

export function loadDesktopConfig(): DesktopConfigView {
  const values = readEnvFile();
  return {
    serverUrl: values.SERVER_WS_URL?.trim() || 'ws://localhost:3000',
    agentKey: values.AGENT_KEY?.trim() || '',
    logLevel: values.LOG_LEVEL?.trim() || 'info',
    agentVersion: values.AGENT_VERSION?.trim() || '1.1.0',
    hostname: os.hostname(),
    configPath: resolveConfigPath(),
  };
}
