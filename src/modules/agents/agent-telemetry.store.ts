import { Injectable } from '@nestjs/common';
import { Agent } from '@prisma/client';

export interface AgentLiveTelemetry {
  agentId: string;
  ip: string;
  cpuPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  ramLabel: string;
  timestamp: number;
}

@Injectable()
export class AgentTelemetryStore {
  private readonly live = new Map<string, AgentLiveTelemetry>();

  set(agentId: string, data: Omit<AgentLiveTelemetry, 'agentId'>): void {
    this.live.set(agentId, { agentId, ...data });
  }

  get(agentId: string): AgentLiveTelemetry | undefined {
    return this.live.get(agentId);
  }

  delete(agentId: string): void {
    this.live.delete(agentId);
  }

  /** Gắn telemetry RAM/CPU/IP vào metadata — không ghi DB. */
  enrich<T extends Agent>(agent: T): T {
    const live = this.live.get(agent.id);
    if (!live) return agent;

    const baseMeta =
      agent.metadata && typeof agent.metadata === 'object' && !Array.isArray(agent.metadata)
        ? (agent.metadata as Record<string, unknown>)
        : {};

    return {
      ...agent,
      ip: live.ip || agent.ip,
      metadata: {
        ...baseMeta,
        ip: live.ip,
        cpuPercent: live.cpuPercent,
        ramUsedBytes: live.ramUsedBytes,
        ramTotalBytes: live.ramTotalBytes,
        ramLabel: live.ramLabel,
        liveTelemetryAt: live.timestamp,
      },
    };
  }

  enrichMany<T extends Agent>(agents: T[]): T[] {
    return agents.map((a) => this.enrich(a));
  }
}
