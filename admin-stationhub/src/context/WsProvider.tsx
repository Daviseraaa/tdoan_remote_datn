import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/hooks/useAuth';
import {
  connectWs,
  disconnectWs,
  type AgentTelemetryWsPayload,
  type TaskWsPayload,
} from '@/src/lib/ws';
import type { Task, TaskStatus } from '@/src/types/api';
import { normalizeRamLabel } from '@/src/lib/mappers';
import { queryKeys } from '@/src/lib/queryKeys';
import type { Agent, PaginatedResponse } from '@/src/types/api';

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      disconnectWs();
      return;
    }

    const patchAgentTelemetry = (payload: AgentTelemetryWsPayload) => {
      const mergeAgent = (agent: Agent): Agent => {
        if (agent.id !== payload.agentId) return agent;
        const baseMeta =
          agent.metadata && typeof agent.metadata === 'object'
            ? { ...(agent.metadata as Record<string, unknown>) }
            : {};
        return {
          ...agent,
          ip: payload.ip || agent.ip,
          metadata: {
            ...baseMeta,
            ip: payload.ip,
            cpuPercent: payload.cpuPercent,
            ramUsedBytes: payload.ramUsedBytes,
            ramTotalBytes: payload.ramTotalBytes,
            ramLabel: normalizeRamLabel(payload.ramLabel),
            liveTelemetryAt: payload.timestamp,
          },
        };
      };

      queryClient.setQueriesData<PaginatedResponse<Agent>>(
        { queryKey: ['agents'] },
        (old) => {
          if (!old?.items?.length) return old;
          return {
            ...old,
            items: old.items.map(mergeAgent),
          };
        },
      );
    };

    const patchTaskStatus = (payload: TaskWsPayload) => {
      const status = payload.status as TaskStatus;
      const patch = (task: Task): Task =>
        task.id === payload.taskId ? { ...task, status } : task;

      queryClient.setQueriesData<{ items: Task[]; meta: unknown }>(
        { queryKey: ['tasks'] },
        (old) => {
          if (!old?.items?.length) return old;
          return { ...old, items: old.items.map(patch) };
        },
      );
      queryClient.setQueriesData<{ items: Task[]; meta: unknown }>(
        { queryKey: ['admin', 'tasks'] },
        (old) => {
          if (!old?.items?.length) return old;
          return { ...old, items: old.items.map(patch) };
        },
      );
      queryClient.setQueriesData<Task>({ queryKey: ['task'] }, (old) =>
        old?.id === payload.taskId ? { ...old, status } : old,
      );
    };

    connectWs(
      (_event, payload) => {
        patchTaskStatus(payload);
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
        queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
        queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task'] });
        queryClient.invalidateQueries({ queryKey: ['agents'] });
      },
      patchAgentTelemetry,
    );

    return () => disconnectWs();
  }, [user, queryClient]);

  return <>{children}</>;
}
