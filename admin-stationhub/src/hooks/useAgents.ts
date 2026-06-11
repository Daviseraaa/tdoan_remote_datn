import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as agentsApi from '@/src/api/agents';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import type { Agent, CreateAgentDto, UpdateRemoteAccessDto, WakeAgentDto } from '@/src/types/api';
import type { ListAgentsParams } from '@/src/api/agents';

function patchAgentMetadata(
  qc: QueryClient,
  isAdmin: boolean,
  id: string,
  patch: Record<string, unknown>,
) {
  qc.setQueryData<Agent>(queryKeys.agent(isAdmin, id), (old) => {
    if (!old) return old;
    const base =
      old.metadata && typeof old.metadata === 'object' && !Array.isArray(old.metadata)
        ? (old.metadata as Record<string, unknown>)
        : {};
    return { ...old, metadata: { ...base, ...patch } };
  });

  qc.setQueriesData<{ items?: Agent[] }>({ queryKey: ['agents'] }, (old) => {
    if (!old?.items) return old;
    return {
      ...old,
      items: old.items.map((agent) => {
        if (agent.id !== id) return agent;
        const base =
          agent.metadata &&
          typeof agent.metadata === 'object' &&
          !Array.isArray(agent.metadata)
            ? (agent.metadata as Record<string, unknown>)
            : {};
        return { ...agent, metadata: { ...base, ...patch } };
      }),
    };
  });
}

export function useAgentsList(params: ListAgentsParams = {}) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.agents(isAdmin, params),
    queryFn: () => agentsApi.listAgents(isAdmin, params),
    refetchInterval: 10_000,
  });
}

export function useAgentDetail(id: string | undefined, pollMs?: number) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: queryKeys.agent(isAdmin, id ?? ''),
    queryFn: () => agentsApi.getAgent(isAdmin, id!),
    enabled: Boolean(id),
    refetchInterval: pollMs,
  });
}

export function useAgentMutations() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: ['agents'] });

  const create = useMutation({
    mutationFn: (dto: CreateAgentDto) => agentsApi.createAgent(dto),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => agentsApi.deleteAgent(isAdmin, id),
    onSuccess: invalidate,
  });

  const regenerateKey = useMutation({
    mutationFn: (id: string) => agentsApi.regenerateAgentKey(isAdmin, id),
    onSuccess: invalidate,
  });

  const syncChromeProfiles = useMutation({
    mutationFn: (id: string) => agentsApi.syncAgentChromeProfiles(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, id) });
      invalidate();
    },
  });

  const wakeAgent = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto?: WakeAgentDto }) =>
      agentsApi.wakeAgent(isAdmin, id, dto),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, id) });
      invalidate();
    },
  });

  const updateRemoteAccess = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRemoteAccessDto }) =>
      agentsApi.updateAgentRemoteAccess(isAdmin, id, dto),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, id) });
      invalidate();
    },
  });

  const startRemote = useMutation({
    mutationFn: (id: string) => agentsApi.startAgentRemote(isAdmin, id),
    onSuccess: (_data, id) => {
      patchAgentMetadata(qc, isAdmin, id, { rustdeskRemoteActive: true });
      stopRemote.reset();
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, id) });
      invalidate();
    },
  });

  const stopRemote = useMutation({
    mutationFn: (id: string) => agentsApi.stopAgentRemote(isAdmin, id),
    onSuccess: (_data, id) => {
      patchAgentMetadata(qc, isAdmin, id, { rustdeskRemoteActive: false });
      startRemote.reset();
      void qc.invalidateQueries({ queryKey: queryKeys.agent(isAdmin, id) });
      invalidate();
    },
  });

  return {
    create,
    remove,
    regenerateKey,
    syncChromeProfiles,
    wakeAgent,
    updateRemoteAccess,
    startRemote,
    stopRemote,
  };
}
