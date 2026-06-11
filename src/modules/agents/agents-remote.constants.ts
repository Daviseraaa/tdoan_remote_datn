export const DEFAULT_RUSTDESK_PATH = 'C:\\Program Files\\RustDesk\\rustdesk.exe';

export function readRustdeskConfig(metadata: Record<string, unknown>): {
  provider: string;
  rustdeskPath: string;
  rustdeskId: string;
  rustdeskPassword: string;
} {
  const provider =
    typeof metadata.remoteProvider === 'string' && metadata.remoteProvider.trim()
      ? metadata.remoteProvider.trim().toLowerCase()
      : 'rustdesk';
  const rustdeskPath =
    typeof metadata.rustdeskPath === 'string' && metadata.rustdeskPath.trim()
      ? metadata.rustdeskPath.trim()
      : DEFAULT_RUSTDESK_PATH;
  const rustdeskId =
    typeof metadata.rustdeskId === 'string' ? metadata.rustdeskId.trim() : '';
  const rustdeskPassword =
    typeof metadata.rustdeskPassword === 'string'
      ? metadata.rustdeskPassword
      : '';
  return { provider, rustdeskPath, rustdeskId, rustdeskPassword };
}
