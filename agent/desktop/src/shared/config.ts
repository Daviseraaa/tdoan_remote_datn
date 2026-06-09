import * as os from 'os';
import { BUILD_ENV } from './build-config';
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
    serverUrl: BUILD_ENV.SERVER_WS_URL,
    agentKey: values.AGENT_KEY?.trim() || '',
    logLevel: BUILD_ENV.LOG_LEVEL,
    agentVersion: BUILD_ENV.AGENT_VERSION,
    hostname: os.hostname(),
    configPath: resolveConfigPath(),
  };
}
