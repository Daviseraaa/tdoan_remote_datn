/**
 * Biến tab "Nâng cao" cũ — cố định trong code, không đọc/ghi agent.env.
 * Sửa giá trị tại đây (và `core/src/config/dev_defaults.rs` khi build core).
 */

export const BUILD_ENV_KEYS = [
  'SERVER_WS_URL',
  'AGENT_VERSION',
  'PUBLIC_IP_LOOKUP_URL',
  'LOG_LEVEL',
] as const;

export type BuildEnvKey = (typeof BUILD_ENV_KEYS)[number];

export const BUILD_ENV: Record<BuildEnvKey, string> = {
  SERVER_WS_URL: 'ws://100.108.185.69:3000',
  AGENT_VERSION: '1.1.0',
  PUBLIC_IP_LOOKUP_URL: 'https://api.ipify.org',
  LOG_LEVEL: 'info',
};

export function isBuildEnvKey(key: string): key is BuildEnvKey {
  return (BUILD_ENV_KEYS as readonly string[]).includes(key);
}

export function stripBuildEnvKeys(values: Record<string, string>): Record<string, string> {
  const out = { ...values };
  for (const k of BUILD_ENV_KEYS) delete out[k];
  return out;
}

/** Env inject vào process Rust khi tray spawn agent. */
export function agentSpawnEnv(): Record<BuildEnvKey, string> {
  return { ...BUILD_ENV };
}
