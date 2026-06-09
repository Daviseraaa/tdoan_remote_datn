import { apiFetch } from '@/src/lib/api';
import {
  agentDeletePath,
  agentDetailPath,
  agentRegenerateKeyPath,
  agentRemoteAccessPath,
  agentWakePath,
  agentsListPath,
} from '@/src/lib/apiScope';
import { normalizePaginated } from '@/src/lib/normalize';
import type {
  Agent,
  AgentChromeProfile,
  AgentStatus,
  CreateAgentDto,
  PaginatedResponse,
  UpdateRemoteAccessDto,
  WakeAgentDto,
} from '@/src/types/api';

export interface ListAgentsParams {
  page?: number;
  limit?: number;
  status?: AgentStatus;
}

export async function listAgents(
  admin: boolean,
  params: ListAgentsParams = {},
): Promise<PaginatedResponse<Agent>> {
  const q = new URLSearchParams();
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  if (params.status) q.set('status', params.status);
  const query = q.toString();
  const path = agentsListPath(admin);
  const raw = await apiFetch<unknown>(`${path}${query ? `?${query}` : ''}`);
  return normalizePaginated<Agent>(raw);
}

export async function createAgent(dto: CreateAgentDto): Promise<Agent> {
  return apiFetch<Agent>('/agents', { method: 'POST', body: dto });
}

export async function getAgent(admin: boolean, id: string): Promise<Agent> {
  return apiFetch<Agent>(agentDetailPath(admin, id));
}

export async function deleteAgent(admin: boolean, id: string): Promise<void> {
  return apiFetch<void>(agentDeletePath(admin, id), { method: 'DELETE' });
}

export async function regenerateAgentKey(
  admin: boolean,
  id: string,
): Promise<Agent> {
  return apiFetch<Agent>(agentRegenerateKeyPath(admin, id), { method: 'POST' });
}

export async function syncAgentChromeProfiles(
  agentId: string,
): Promise<{ profiles: AgentChromeProfile[]; count: number }> {
  return apiFetch<{ profiles: AgentChromeProfile[]; count: number }>(
    `/agents/${agentId}/chrome-profiles/sync`,
    { method: 'POST' },
  );
}

export async function wakeAgent(
  admin: boolean,
  id: string,
  dto: WakeAgentDto = {},
): Promise<{
  ok: boolean;
  agentId: string;
  macAddress: string;
  broadcast: string;
  port: number;
  message: string;
}> {
  return apiFetch(agentWakePath(admin, id), { method: 'POST', body: dto });
}

export async function updateAgentRemoteAccess(
  admin: boolean,
  id: string,
  dto: UpdateRemoteAccessDto,
): Promise<Agent> {
  return apiFetch<Agent>(agentRemoteAccessPath(admin, id), {
    method: 'PATCH',
    body: dto,
  });
}
