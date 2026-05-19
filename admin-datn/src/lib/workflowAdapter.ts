import { AlertCircle, PlayCircle, Split, Terminal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Workflow, WorkflowStep } from '@/src/types/api';

export interface UiWorkflowNode {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  code?: string;
  icon?: LucideIcon;
  color?: string;
  position: { x: number; y: number };
  status: string;
}

export interface UiWorkflow {
  id: string;
  name: string;
  description: string;
  status: string;
  lastRun: string;
  nodes: UiWorkflowNode[];
  connections: Array<{ d: string; color: string }>;
  _raw?: Workflow;
}

function stepIcon(type: string): LucideIcon {
  if (type === 'SCRIPT' || type === 'COMMAND') return Terminal;
  if (type === 'CONDITION') return Split;
  if (type === 'DELAY') return AlertCircle;
  return PlayCircle;
}

function stepTitle(step: WorkflowStep): string {
  const cfg = step.config ?? {};
  if (typeof cfg.title === 'string') return cfg.title;
  if (typeof cfg.command === 'string') return cfg.command;
  return step.type;
}

export function workflowToUi(wf: Workflow): UiWorkflow {
  const steps = [...(wf.steps ?? [])].sort((a, b) => a.order - b.order);
  const nodes: UiWorkflowNode[] = steps.map((step, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      id: step.id ?? `node-${step.order}`,
      type: step.type,
      icon: stepIcon(step.type),
      color: 'text-primary',
      title: stepTitle(step),
      subtitle: wf.cronExpression,
      code:
        typeof step.config?.command === 'string'
          ? step.config.command
          : JSON.stringify(step.config ?? {}),
      position: { x: 80 + col * 340, y: 80 + row * 120 },
      status: 'pending',
    };
  });

  return {
    id: wf.id,
    name: wf.name,
    description: wf.description ?? '',
    status: wf.isActive ? 'Running' : 'Idle',
    lastRun: wf.lastExecutedAt ?? wf.updatedAt ?? 'Never',
    nodes:
      nodes.length > 0
        ? nodes
        : [
            {
              id: 'node-1',
              type: 'TRIGGER',
              title: 'Start',
              subtitle: 'Add steps via API',
              position: { x: 80, y: 80 },
              status: 'pending',
            },
          ],
    connections: [],
    _raw: wf,
  };
}

export function uiToWorkflowSteps(nodes: UiWorkflowNode[]): WorkflowStep[] {
  return nodes.map((node, i) => ({
    order: i + 1,
    type: (node.type === 'TRIGGER' ? 'COMMAND' : node.type) as WorkflowStep['type'],
    config:
      node.code && node.code.startsWith('{')
        ? (JSON.parse(node.code) as Record<string, unknown>)
        : { command: node.code ?? node.title, title: node.title },
    onFailure: 'STOP' as const,
  }));
}
