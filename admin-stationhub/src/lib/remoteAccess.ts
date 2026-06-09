export interface AgentNetworkInterface {
  name: string;
  mac: string;
  kind?: string;
  status?: string;
}

export interface AgentRemoteAccessUi {
  wolMacAddress: string;
  wolBroadcast: string;
  rdpHost: string;
  rdpPort: number;
  rdpEnabled: boolean;
  networkInterfaces: AgentNetworkInterface[];
  lastWakeAt?: string;
  rdpConnectionHint: string;
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
    rdpConnectionHint,
  };
}
