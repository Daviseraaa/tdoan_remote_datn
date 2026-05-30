import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/src/lib/api';
import type { ChromeScript, UpdateChromeScriptDto } from '@/src/types/api';

export function useChromeScriptDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['chrome-scripts', id],
    queryFn: () => apiFetch<ChromeScript>(`/chrome-scripts/${id}`),
    enabled: Boolean(id),
  });
}

export function useChromeScriptsList(agentId?: string) {
  const q = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
  return useQuery({
    queryKey: ['chrome-scripts', agentId ?? 'all'],
    queryFn: () => apiFetch<ChromeScript[]>(`/chrome-scripts${q}`),
  });
}

export function useChromeScriptMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['chrome-scripts'] });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/chrome-scripts/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const createTemplate = useMutation({
    mutationFn: (args: { id: string; agentId: string; name?: string }) =>
      apiFetch<{ template: { id: string }; scriptId: string }>(
        `/chrome-scripts/${args.id}/create-template`,
        {
          method: 'POST',
          body: { agentId: args.agentId, name: args.name },
        },
      ),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (args: { id: string; dto: UpdateChromeScriptDto }) =>
      apiFetch<ChromeScript>(`/chrome-scripts/${args.id}`, {
        method: 'PATCH',
        body: args.dto,
      }),
    onSuccess: (_data, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['chrome-scripts', vars.id] });
    },
  });

  const syncFromAgent = useMutation({
    mutationFn: (agentId: string) =>
      apiFetch<{
        inserted: number;
        updated: number;
        skipped: number;
        total: number;
        agentId: string;
        agentName: string;
      }>('/chrome-scripts/sync', {
        method: 'POST',
        body: { agentId },
      }),
    onSuccess: invalidate,
  });

  return { remove, createTemplate, syncFromAgent, update };
}
