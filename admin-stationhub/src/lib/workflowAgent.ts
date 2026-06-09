import { t } from '@/src/i18n/t';
import type { Agent, Workflow } from '@/src/types/api';

export function workflowAgentIds(wf: Workflow): string[] {
  const seen = new Set<string>();
  for (const step of wf.steps ?? []) {
    const id = (step.config as { agentId?: string } | undefined)?.agentId;
    if (id) seen.add(id);
  }
  return [...seen];
}

export function workflowAgentLabel(wf: Workflow, agents: Agent[]): string {
  const ids = workflowAgentIds(wf);
  if (!ids.length) return t('workflows.noAgentAssigned');
  const names = ids.map((id) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8));
  if (names.length === 1) return names[0]!;
  return t('workflows.agentsSummary', { first: names[0]!, more: String(names.length - 1) });
}
