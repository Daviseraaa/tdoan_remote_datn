export interface AgentNetworkInterface {
  name: string;
  mac: string;
  kind?: string;
  status?: string;
}

export const DEFAULT_RUSTDESK_PATH = 'C:\\Program Files\\RustDesk\\rustdesk.exe';

/** RustDesk hiển thị ID có khoảng trắng (vd. `1 871 087 293`) — URL cần chuỗi liền. */
export function normalizeRustDeskId(id: string): string {
  return id.replace(/\s+/g, '').trim();
}

/** URL scheme mở RustDesk client trên máy admin và kết nối tới ID đã lưu. */
export function buildRustDeskConnectUrls(id: string, password: string): string[] {
  const normalizedId = normalizeRustDeskId(id);
  const trimmedPass = password.trim();
  if (!normalizedId || !trimmedPass) return [];
  const encodedPass = encodeURIComponent(trimmedPass);
  return [
    `rustdesk://connection/new/${normalizedId}?password=${encodedPass}`,
    `rustdesk://${normalizedId}?password=${encodedPass}`,
  ];
}

/** Mở RustDesk trên máy đang dùng admin UI (cần RustDesk đã cài + đăng ký protocol). */
export function openRustDeskConnect(id: string, password: string): boolean {
  const urls = buildRustDeskConnectUrls(id, password);
  if (!urls.length) return false;

  for (const url of urls) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      window.setTimeout(() => iframe.remove(), 4000);
    } catch {
      /* ignore */
    }
  }

  return true;
}

export interface AgentRemoteAccessUi {
  wolMacAddress: string;
  wolBroadcast: string;
  rdpHost: string;
  rdpPort: number;
  rdpEnabled: boolean;
  networkInterfaces: AgentNetworkInterface[];
  lastWakeAt?: string;
  lastRemoteStartAt?: string;
  rdpConnectionHint: string;
  remoteProvider: string;
  rustdeskPath: string;
  rustdeskId: string;
  rustdeskPassword: string;
  rustdeskRemoteActive: boolean;
}

export function parseAgentRemoteAccess(
  metadata: Record<string, unknown> | null | undefined,
  fallbackHostname?: string,
): AgentRemoteAccessUi {
  const m = metadata ?? {};
  const wolMacAddress =
    typeof m.wolMacAddress === 'string' && m.wolMacAddress.trim()
      ? m.wolMacAddress.trim()
      : '';
  const wolBroadcast =
    typeof m.wolBroadcast === 'string' && m.wolBroadcast.trim()
      ? m.wolBroadcast.trim()
      : typeof m.wolBroadcastSuggested === 'string' && m.wolBroadcastSuggested.trim()
        ? m.wolBroadcastSuggested.trim()
        : '';
  const rdpHost =
    (typeof m.rdpHost === 'string' && m.rdpHost.trim()
      ? m.rdpHost.trim()
      : '') ||
    fallbackHostname?.trim() ||
    '';
  const rdpPort =
    typeof m.rdpPort === 'number' && m.rdpPort > 0 ? m.rdpPort : 3389;
  const rdpEnabled = m.rdpEnabled === true;
  const lastWakeAt =
    typeof m.lastWakeAt === 'string' ? m.lastWakeAt : undefined;
  const lastRemoteStartAt =
    typeof m.lastRemoteStartAt === 'string' ? m.lastRemoteStartAt : undefined;
  const remoteProvider =
    typeof m.remoteProvider === 'string' && m.remoteProvider.trim()
      ? m.remoteProvider.trim()
      : 'rustdesk';
  const rustdeskPath =
    typeof m.rustdeskPath === 'string' && m.rustdeskPath.trim()
      ? m.rustdeskPath.trim()
      : DEFAULT_RUSTDESK_PATH;
  const rustdeskId =
    typeof m.rustdeskId === 'string' ? m.rustdeskId : '';
  const rustdeskPassword =
    typeof m.rustdeskPassword === 'string' ? m.rustdeskPassword : '';
  const rustdeskRemoteActive = m.rustdeskRemoteActive === true;

  const networkInterfaces: AgentNetworkInterface[] = Array.isArray(m.networkInterfaces)
    ? m.networkInterfaces
        .filter((x): x is Record<string, unknown> => x && typeof x === 'object')
        .map((x) => ({
          name: typeof x.name === 'string' ? x.name : '—',
          mac: typeof x.mac === 'string' ? x.mac : '—',
          kind: typeof x.kind === 'string' ? x.kind : undefined,
          status: typeof x.status === 'string' ? x.status : undefined,
        }))
    : [];

  const hostForRdp = rdpHost || 'localhost';
  const rdpConnectionHint = rdpPort === 3389
    ? hostForRdp
    : `${hostForRdp}:${rdpPort}`;

  return {
    wolMacAddress,
    wolBroadcast,
    rdpHost,
    rdpPort,
    rdpEnabled,
    networkInterfaces,
    lastWakeAt,
    lastRemoteStartAt,
    rdpConnectionHint,
    remoteProvider,
    rustdeskPath,
    rustdeskId,
    rustdeskPassword,
    rustdeskRemoteActive,
  };
}
