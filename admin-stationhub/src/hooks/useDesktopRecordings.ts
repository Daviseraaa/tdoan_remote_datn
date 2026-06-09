import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/src/lib/api';
import type { DesktopRecording, UpdateDesktopRecordingDto } from '@/src/types/api';

export function useDesktopRecordingDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['desktop-recordings', id],
    queryFn: () => apiFetch<DesktopRecording>(`/desktop-recordings/${id}`),
    enabled: Boolean(id),
  });
}

export function useDesktopRecordingsList(agentId?: string) {
  const q = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
  return useQuery({
    queryKey: ['desktop-recordings', agentId ?? 'all'],
    queryFn: () => apiFetch<DesktopRecording[]>(`/desktop-recordings${q}`),
  });
}

export function useDesktopRecordingMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['desktop-recordings'] });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean }>(`/desktop-recordings/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  const createTemplate = useMutation({
    mutationFn: (args: { id: string; agentId: string; name?: string }) =>
      apiFetch<{ template: { id: string }; recordingId: string }>(
        `/desktop-recordings/${args.id}/create-template`,
        {
          method: 'POST',
          body: { agentId: args.agentId, name: args.name },
        },
      ),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (args: { id: string; dto: UpdateDesktopRecordingDto }) =>
      apiFetch<DesktopRecording>(`/desktop-recordings/${args.id}`, {
        method: 'PATCH',
        body: args.dto,
      }),
    onSuccess: (_data, vars) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['desktop-recordings', vars.id] });
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
      }>('/desktop-recordings/sync', {
        method: 'POST',
        body: { agentId },
      }),
    onSuccess: invalidate,
  });

  return { remove, createTemplate, syncFromAgent, update };
}
