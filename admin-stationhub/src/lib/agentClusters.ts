import type { Agent, AgentStatus } from '@/src/types/api';
import { apiErrorMessage } from '@/src/lib/api';

export function isAgentOnline(status?: AgentStatus): boolean {
  return status === 'ONLINE' || status === 'BUSY';
}

export type AgentCluster<T> = {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  online: boolean;
  items: T[];
};

type AgentLinked = {
  agentId?: string | null;
  agent?: { id: string; name: string } | null;
};

export function buildAgentClusters<T extends AgentLinked>(
  items: T[],
  agents: Agent[],
): AgentCluster<T>[] {
  const byAgent = new Map<string, T[]>();
  for (const item of items) {
    const aid = item.agentId ?? item.agent?.id;
    if (!aid) continue;
    const arr = byAgent.get(aid) ?? [];
    arr.push(item);
    byAgent.set(aid, arr);
  }

  const agentById = new Map(agents.map((a) => [a.id, a]));
  const clusterIds = new Set<string>(byAgent.keys());
  for (const agent of agents) {
    if (isAgentOnline(agent.status)) clusterIds.add(agent.id);
  }

  const clusters: AgentCluster<T>[] = [];
  for (const id of clusterIds) {
    const agent = agentById.get(id);
    const sample = byAgent.get(id)?.[0];
    clusters.push({
      agentId: id,
      agentName: agent?.name ?? sample?.agent?.name ?? id,
      status: agent?.status ?? 'OFFLINE',
      online: isAgentOnline(agent?.status),
      items: byAgent.get(id) ?? [],
    });
  }

  clusters.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.agentName.localeCompare(b.agentName, 'vi');
  });

  return clusters;
}

export type SyncSummaryResult = {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
  agentId: string;
  agentName: string;
};

export type SyncAllSummary = {
  results: SyncSummaryResult[];
  errors: { agentName: string; message: string }[];
  totals: { inserted: number; updated: number; skipped: number; total: number };
};

export async function syncAllOnlineAgents(
  agents: Agent[],
  syncOne: (agentId: string) => Promise<SyncSummaryResult>,
): Promise<SyncAllSummary> {
  const online = agents.filter((a) => isAgentOnline(a.status));
  const results: SyncSummaryResult[] = [];
  const errors: { agentName: string; message: string }[] = [];
  const totals = { inserted: 0, updated: 0, skipped: 0, total: 0 };

  for (const agent of online) {
    try {
      const res = await syncOne(agent.id);
      results.push(res);
      totals.inserted += res.inserted;
      totals.updated += res.updated;
      totals.skipped += res.skipped;
      totals.total += res.total;
    } catch (err) {
      errors.push({
        agentName: agent.name,
        message: apiErrorMessage(err),
      });
    }
  }

  return { results, errors, totals };
}
