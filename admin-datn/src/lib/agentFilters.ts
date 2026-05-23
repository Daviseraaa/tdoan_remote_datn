import type { Agent, AgentStatus } from '@/src/types/api';
import { t } from '@/src/i18n/t';

export type AgentStatusFilter = 'all' | Extract<AgentStatus, 'ONLINE' | 'OFFLINE'>;
export type AgentClusterFilter = 'all' | 'windows' | 'mac' | 'linux';

const STATUS_ORDER: AgentStatusFilter[] = ['all', 'ONLINE', 'OFFLINE'];
const CLUSTER_ORDER: AgentClusterFilter[] = ['all', 'windows', 'mac', 'linux'];

export function nextStatusFilter(current: AgentStatusFilter): AgentStatusFilter {
  const i = STATUS_ORDER.indexOf(current);
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

export function nextClusterFilter(current: AgentClusterFilter): AgentClusterFilter {
  const i = CLUSTER_ORDER.indexOf(current);
  return CLUSTER_ORDER[(i + 1) % CLUSTER_ORDER.length];
}

export function clusterFilterLabel(cluster: AgentClusterFilter): string {
  const labels: Record<AgentClusterFilter, string> = {
    all: t('common.all'),
    windows: t('common.windows'),
    mac: t('common.mac'),
    linux: t('common.linux'),
  };
  return labels[cluster];
}

export function statusFilterLabel(status: AgentStatusFilter): string {
  const labels: Record<AgentStatusFilter, string> = {
    all: t('common.all'),
    ONLINE: t('common.online'),
    OFFLINE: t('common.offline'),
  };
  return labels[status];
}

export function matchesCluster(os: string | undefined, cluster: AgentClusterFilter): boolean {
  if (cluster === 'all') return true;
  const s = (os ?? '').toLowerCase();
  if (cluster === 'windows') {
    return s.includes('win') || s.includes('windows');
  }
  if (cluster === 'mac') {
    return s.includes('mac') || s.includes('darwin') || s.includes('os x');
  }
  if (cluster === 'linux') {
    return (
      s.includes('linux') ||
      s.includes('ubuntu') ||
      s.includes('debian') ||
      s.includes('fedora') ||
      s.includes('centos')
    );
  }
  return true;
}

export function filterAgentsByCluster(
  agents: Agent[],
  cluster: AgentClusterFilter,
): Agent[] {
  if (cluster === 'all') return agents;
  return agents.filter((a) => matchesCluster(a.os, cluster));
}

export function filterAgentsByStatus(
  agents: Agent[],
  status: AgentStatusFilter,
): Agent[] {
  if (status === 'all') return agents;
  return agents.filter((a) => a.status === status);
}

export function isAgentClusterFilter(v: string | null): v is AgentClusterFilter {
  return v === 'all' || v === 'windows' || v === 'mac' || v === 'linux';
}

export function isAgentStatusFilter(v: string | null): v is AgentStatusFilter {
  return v === 'all' || v === 'ONLINE' || v === 'OFFLINE';
}

/** Query cho link Dashboard → Agents (`?status=&cluster=`). */
export function agentsPageSearchParams(
  status: AgentStatusFilter,
  cluster: AgentClusterFilter,
): string {
  const p = new URLSearchParams();
  if (status !== 'all') p.set('status', status);
  if (cluster !== 'all') p.set('cluster', cluster);
  const s = p.toString();
  return s ? `?${s}` : '';
}
