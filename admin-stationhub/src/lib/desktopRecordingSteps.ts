import { t } from '@/src/i18n/t';
import { randomIdShort } from '@/src/lib/randomId';
import {
  newDesktopStep,
  serializeDesktopStep,
  summarizeDesktopStep,
  type DesktopAction,
  type DesktopStep,
} from '@/src/lib/taskTemplatePayload';

export type { DesktopAction, DesktopStep };
export { newDesktopStep, summarizeDesktopStep as summarizeStep };

const ACTIONS: DesktopAction[] = [
  'delay',
  'openApp',
  'move',
  'click',
  'typeText',
  'keyCombo',
  'scroll',
];

function isAction(v: string): v is DesktopAction {
  return ACTIONS.includes(v as DesktopAction);
}

function parseOneStep(raw: unknown, index: number): DesktopStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const actionRaw = typeof o.action === 'string' ? o.action : '';
  if (!isAction(actionRaw)) return null;

  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim()
      : `step-${index}-${randomIdShort()}`;

  switch (actionRaw) {
    case 'delay':
      return { id, action: actionRaw, ms: Number(o.ms) || 0 };
    case 'openApp':
      return { id, action: actionRaw, target: String(o.target ?? '') };
    case 'move':
      return { id, action: actionRaw, x: Number(o.x) || 0, y: Number(o.y) || 0 };
    case 'click':
      return {
        id,
        action: actionRaw,
        x: o.x != null ? Number(o.x) : undefined,
        y: o.y != null ? Number(o.y) : undefined,
        button: o.button === 'right' ? 'right' : 'left',
        double: Boolean(o.double),
      };
    case 'typeText':
      return { id, action: actionRaw, text: String(o.text ?? '') };
    case 'keyCombo': {
      let keys = '';
      if (typeof o.keys === 'string') {
        keys = o.keys;
      } else if (Array.isArray(o.keys)) {
        keys = o.keys.map(String).join('+');
      }
      return { id, action: actionRaw, keys };
    }
    case 'scroll':
      return {
        id,
        action: actionRaw,
        direction: (['up', 'down', 'left', 'right'].includes(String(o.direction))
          ? o.direction
          : 'down') as DesktopStep['direction'],
        amount: Number(o.amount) || 3,
      };
    default:
      return null;
  }
}

export function parseStepsFromJson(raw: unknown): DesktopStep[] {
  if (!Array.isArray(raw)) return [];
  const out: DesktopStep[] = [];
  raw.forEach((item, i) => {
    const step = parseOneStep(item, i);
    if (step) out.push(step);
  });
  return out;
}

export function parseDesktopStepsDocument(
  text: string,
): { steps: DesktopStep[] } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: t('templateWizard.desktopJsonEmpty') };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { error: t('templateWizard.desktopJsonInvalid') };
  }

  let raw: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { steps?: unknown[] }).steps)) {
    raw = (parsed as { steps: unknown[] }).steps;
  }

  if (!raw) {
    return { error: t('templateWizard.desktopJsonShape') };
  }

  const steps = parseStepsFromJson(raw);
  if (steps.length === 0) {
    return { error: t('templateWizard.desktopJsonNoSteps') };
  }
  return { steps };
}

export function desktopStepsDocumentText(steps: DesktopStep[]): string {
  return JSON.stringify({ steps: stepsToJson(steps) }, null, 2);
}

export function stepsToJson(steps: DesktopStep[]): unknown[] {
  return steps.map((s) => serializeDesktopStep(s));
}

export function validateSteps(steps: DesktopStep[]): string | null {
  if (steps.length === 0) return t('desktopRecordings.stepsRequired');
  return null;
}

export function actionLabel(action: DesktopAction): string {
  return t(`templateWizard.desktopAction_${action}` as 'templateWizard.desktopAction_delay');
}

export const DESKTOP_STEP_PALETTE: DesktopAction[] = [
  'delay',
  'openApp',
  'move',
  'click',
  'typeText',
  'keyCombo',
  'scroll',
];
