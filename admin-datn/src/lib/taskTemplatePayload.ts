import type { Agent, CreateTaskTemplateDto, TaskTemplate, TaskType } from '@/src/types/api';
import { t } from '@/src/i18n/t';

export type DesktopAction =
  | 'delay'
  | 'openApp'
  | 'move'
  | 'click'
  | 'typeText'
  | 'keyCombo'
  | 'scroll';

export interface DesktopStep {
  id: string;
  action: DesktopAction;
  ms?: number;
  target?: string;
  x?: number;
  y?: number;
  button?: 'left' | 'right';
  double?: boolean;
  text?: string;
  keys?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export type OpenAppMode = 'path' | 'app' | 'query';

export interface TemplateEditorState {
  name: string;
  type: TaskType;
  agentId: string;
  agent: Agent | null;
  command: string;
  openAppMode: OpenAppMode;
  openAppValue: string;
  desktopSteps: DesktopStep[];
  timeout: number;
  priority: number;
}

export const SELECTABLE_TEMPLATE_TYPES: TaskType[] = [
  'COMMAND',
  'SCRIPT',
  'SYSTEM_INFO',
  'OPEN_APP',
  'OPEN_BROWSER',
  'CHROME_EXTENSION',
  'DESKTOP_AUTOMATION',
];

export const DEFAULT_TEMPLATE_STATE: TemplateEditorState = {
  name: '',
  type: 'COMMAND',
  agentId: '',
  agent: null,
  command: '',
  openAppMode: 'path',
  openAppValue: '',
  desktopSteps: [],
  timeout: 60000,
  priority: 5,
};

export function isWindowsAgent(os?: string): boolean {
  return (os ?? '').toLowerCase().includes('win');
}

export function newDesktopStep(action: DesktopAction): DesktopStep {
  const base = { id: crypto.randomUUID(), action };
  switch (action) {
    case 'delay':
      return { ...base, ms: 500 };
    case 'openApp':
      return { ...base, target: '' };
    case 'move':
      return { ...base, x: 0, y: 0 };
    case 'click':
      return { ...base, x: 0, y: 0, button: 'left', double: false };
    case 'typeText':
      return { ...base, text: '' };
    case 'keyCombo':
      return { ...base, keys: 'ctrl+c' };
    case 'scroll':
      return { ...base, direction: 'down', amount: 3 };
    default:
      return base;
  }
}

function serializeDesktopStep(step: DesktopStep): Record<string, unknown> {
  const { action } = step;
  switch (action) {
    case 'delay':
      return { action, ms: step.ms ?? 0 };
    case 'openApp':
      return { action, target: step.target ?? '' };
    case 'move':
      return { action, x: step.x ?? 0, y: step.y ?? 0 };
    case 'click': {
      const o: Record<string, unknown> = { action, button: step.button ?? 'left' };
      if (step.x != null) o.x = step.x;
      if (step.y != null) o.y = step.y;
      if (step.double) o.double = true;
      return o;
    }
    case 'typeText':
      return { action, text: step.text ?? '' };
    case 'keyCombo':
      return { action, keys: step.keys ?? '' };
    case 'scroll':
      return {
        action,
        direction: step.direction ?? 'down',
        amount: step.amount ?? 3,
      };
    default:
      return { action };
  }
}

export function desktopStepsToPayload(steps: DesktopStep[]): Record<string, unknown> {
  return { steps: steps.map(serializeDesktopStep) };
}

function parseDesktopStepsFromTemplate(tpl: TaskTemplate): DesktopStep[] {
  let raw: unknown[] | null = null;
  const p = tpl.payload as Record<string, unknown> | null | undefined;
  if (p && Array.isArray(p.steps)) raw = p.steps;
  const cmd = (tpl.command ?? '').trim();
  if (!raw && (cmd.startsWith('[') || cmd.startsWith('{'))) {
    try {
      const v = JSON.parse(cmd) as unknown;
      if (Array.isArray(v)) raw = v;
      else if (v && typeof v === 'object' && Array.isArray((v as { steps?: unknown[] }).steps)) {
        raw = (v as { steps: unknown[] }).steps;
      }
    } catch {
      raw = null;
    }
  }
  if (!raw) return [];

  return raw.map((item) => {
    const o = item as Record<string, unknown>;
    const action = String(o.action ?? 'delay') as DesktopAction;
    const id = crypto.randomUUID();
    switch (action) {
      case 'delay':
        return { id, action, ms: Number(o.ms) || 0 };
      case 'openApp':
        return { id, action, target: String(o.target ?? '') };
      case 'move':
        return { id, action, x: Number(o.x) || 0, y: Number(o.y) || 0 };
      case 'click':
        return {
          id,
          action,
          x: o.x != null ? Number(o.x) : undefined,
          y: o.y != null ? Number(o.y) : undefined,
          button: (o.button === 'right' ? 'right' : 'left') as 'left' | 'right',
          double: Boolean(o.double),
        };
      case 'typeText':
        return { id, action, text: String(o.text ?? '') };
      case 'keyCombo':
        return { id, action, keys: String(o.keys ?? '') };
      case 'scroll':
        return {
          id,
          action,
          direction: (['up', 'down', 'left', 'right'].includes(String(o.direction))
            ? o.direction
            : 'down') as DesktopStep['direction'],
          amount: Number(o.amount) || 3,
        };
      default:
        return { id, action: 'delay', ms: 500 };
    }
  });
}

export function parseTemplateToForm(tpl: TaskTemplate, agent: Agent | null): TemplateEditorState {
  const base: TemplateEditorState = {
    ...DEFAULT_TEMPLATE_STATE,
    name: tpl.name,
    type: tpl.type,
    agentId: tpl.agentId,
    agent: agent ?? tpl.agent ?? null,
    command: tpl.command ?? '',
    timeout: tpl.timeout ?? 60000,
    priority: tpl.priority ?? 5,
    desktopSteps: [],
    openAppMode: 'path',
    openAppValue: '',
  };

  if (tpl.type === 'OPEN_APP') {
    const p = tpl.payload as Record<string, unknown> | null;
    if (p?.path) {
      base.openAppMode = 'path';
      base.openAppValue = String(p.path);
    } else if (p?.app) {
      base.openAppMode = 'app';
      base.openAppValue = String(p.app);
    } else if (p?.query) {
      base.openAppMode = 'query';
      base.openAppValue = String(p.query);
    } else {
      base.openAppValue = tpl.command ?? '';
    }
    return base;
  }

  if (tpl.type === 'DESKTOP_AUTOMATION') {
    base.desktopSteps = parseDesktopStepsFromTemplate(tpl);
    return base;
  }

  if (tpl.type === 'SYSTEM_INFO') {
    base.command = 'collect';
    return base;
  }

  if (tpl.type === 'OPEN_BROWSER') {
    const p = tpl.payload as Record<string, unknown> | null;
    if (p?.url && typeof p.url === 'string') {
      base.command = p.url;
    }
    return base;
  }

  return base;
}

export function buildTemplateDto(state: TemplateEditorState): CreateTaskTemplateDto {
  const base: CreateTaskTemplateDto = {
    name: state.name.trim(),
    type: state.type,
    agentId: state.agentId,
    command: state.command.trim(),
    timeout: state.timeout,
    priority: state.priority,
  };

  switch (state.type) {
    case 'SYSTEM_INFO':
      return { ...base, command: 'collect' };
    case 'OPEN_APP': {
      const v = state.openAppValue.trim();
      const payload: Record<string, unknown> =
        state.openAppMode === 'path'
          ? { path: v }
          : state.openAppMode === 'app'
            ? { app: v }
            : { query: v };
      return { ...base, command: v, payload };
    }
    case 'OPEN_BROWSER':
      return {
        ...base,
        command: state.command.trim() || 'https://',
        payload: state.command.trim() ? { url: state.command.trim() } : undefined,
      };
    case 'DESKTOP_AUTOMATION':
      return {
        ...base,
        command: '[]',
        payload: desktopStepsToPayload(state.desktopSteps),
      };
    default:
      return base;
  }
}

export function validateTemplateState(state: TemplateEditorState): string | null {
  if (!state.name.trim()) return t('tasks.templateNameRequired');
  if (!state.agentId) return t('templateWizard.agentRequired');
  if (!state.type) return t('templateWizard.typeRequired');

  switch (state.type) {
    case 'COMMAND':
    case 'SCRIPT':
      if (!state.command.trim()) return t('templateWizard.commandRequired');
      break;
    case 'OPEN_APP':
      if (!state.openAppValue.trim()) return t('templateWizard.openAppRequired');
      break;
    case 'OPEN_BROWSER':
      if (!state.command.trim()) return t('templateWizard.commandRequired');
      break;
    case 'DESKTOP_AUTOMATION':
      if (state.desktopSteps.length === 0) return t('templateWizard.desktopStepsRequired');
      if (state.desktopSteps.length > 50) return t('templateWizard.desktopStepsMax');
      break;
    default:
      break;
  }
  return null;
}

export function shellHintForOs(os?: string): string {
  const s = (os ?? '').toLowerCase();
  if (s.includes('win')) return 'PowerShell / CMD';
  if (s.includes('mac') || s.includes('darwin')) return 'bash / zsh';
  if (s.includes('linux')) return 'bash';
  return t('templateWizard.shellGeneric');
}

export function summarizeDesktopStep(step: DesktopStep): string {
  switch (step.action) {
    case 'delay':
      return `${step.ms ?? 0} ms`;
    case 'openApp':
      return step.target?.trim() || '—';
    case 'move':
      return `(${step.x ?? 0}, ${step.y ?? 0})`;
    case 'click': {
      const pos =
        step.x != null && step.y != null ? ` (${step.x}, ${step.y})` : '';
      return `${step.button ?? 'left'}${pos}`;
    }
    case 'typeText':
      return step.text?.slice(0, 40) || '—';
    case 'keyCombo':
      return step.keys || '—';
    case 'scroll':
      return `${step.direction ?? 'down'} ×${step.amount ?? 3}`;
    default:
      return '';
  }
}
