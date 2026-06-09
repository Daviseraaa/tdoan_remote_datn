import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as agentsApi from '@/src/api/agents';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import type { CreateAgentDto, UpdateRemoteAccessDto, WakeAgentDto } from '@/src/types/api';
import type { ListAgentsParams } from '@/src/api/agents';

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

  return { create, remove, regenerateKey, syncChromeProfiles, wakeAgent, updateRemoteAccess };
}
