import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/src/hooks/useAuth';
import {
  connectWs,
  disconnectWs,
  type AgentStatusWsPayload,
  type AgentTelemetryWsPayload,
  type TaskWsPayload,
} from '@/src/lib/ws';
import type { AgentStatus, Task, TaskStatus } from '@/src/types/api';
import { normalizeRamLabel } from '@/src/lib/mappers';
import { queryKeys } from '@/src/lib/queryKeys';
import type { Agent, PaginatedResponse } from '@/src/types/api';

export function WsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const statsInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      disconnectWs();
      return;
    }

    const patchAgentsCache = (mergeAgent: (agent: Agent) => Agent) => {
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
      queryClient.setQueriesData<Agent>({ queryKey: ['agent'] }, (old) =>
        old ? mergeAgent(old) : old,
      );
    };

    const patchAgentTelemetry = (payload: AgentTelemetryWsPayload) => {
      patchAgentsCache((agent) => {
        if (agent.id !== payload.agentId) return agent;
        const baseMeta =
          agent.metadata && typeof agent.metadata === 'object'
            ? { ...(agent.metadata as Record<string, unknown>) }
            : {};
        return {
          ...agent,
          status:
            agent.status === 'OFFLINE' ? ('ONLINE' as AgentStatus) : agent.status,
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
      });
    };

    const patchAgentStatus = (payload: AgentStatusWsPayload) => {
      const nextStatus = payload.status as AgentStatus;
      patchAgentsCache((agent) =>
        agent.id === payload.agentId ? { ...agent, status: nextStatus } : agent,
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

    const scheduleStatsInvalidate = () => {
      if (statsInvalidateTimer.current) return;
      statsInvalidateTimer.current = setTimeout(() => {
        statsInvalidateTimer.current = null;
        queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
        queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      }, 2_000);
    };

    connectWs(
      (_event, payload) => {
        patchTaskStatus(payload);
        scheduleStatsInvalidate();
      },
      patchAgentTelemetry,
      patchAgentStatus,
    );

    return () => {
      if (statsInvalidateTimer.current) {
        clearTimeout(statsInvalidateTimer.current);
        statsInvalidateTimer.current = null;
      }
      disconnectWs();
    };
  }, [user, queryClient]);

  return <>{children}</>;
}
