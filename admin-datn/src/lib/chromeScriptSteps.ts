import { t } from '@/src/i18n/t';
import { randomId, randomIdShort } from '@/src/lib/randomId';

export type ChromeScriptAction =
  | 'click'
  | 'fill'
  | 'delay'
  | 'waitFor'
  | 'snapshotDom';

export type ChromeScriptStep = {
  id: string;
  action: ChromeScriptAction;
  selector?: string;
  selectorIndex?: number;
  text?: string;
  ms?: number;
  timeoutMs?: number;
  maxNodes?: number;
  interactiveOnly?: boolean;
};

const ACTIONS: ChromeScriptAction[] = [
  'click',
  'fill',
  'delay',
  'waitFor',
  'snapshotDom',
];

function isAction(v: string): v is ChromeScriptAction {
  return ACTIONS.includes(v as ChromeScriptAction);
}

function numOrUndef(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function parseOneStep(raw: unknown, index: number): ChromeScriptStep | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const action = typeof o.action === 'string' ? o.action : '';
  if (!isAction(action)) return null;

  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim()
      : `step-${index}-${randomIdShort()}`;

  const base: ChromeScriptStep = {
    id,
    action,
    selector: typeof o.selector === 'string' ? o.selector : undefined,
    selectorIndex: numOrUndef(o.selectorIndex),
    text: typeof o.text === 'string' ? o.text : undefined,
    ms: numOrUndef(o.ms),
    timeoutMs: numOrUndef(o.timeoutMs),
    maxNodes: numOrUndef(o.maxNodes),
    interactiveOnly:
      typeof o.interactiveOnly === 'boolean' ? o.interactiveOnly : undefined,
  };
  return base;
}

export function parseStepsFromJson(raw: unknown): ChromeScriptStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ChromeScriptStep[] = [];
  raw.forEach((item, i) => {
    const step = parseOneStep(item, i);
    if (step) out.push(step);
  });
  return out;
}

export function stepsToJson(steps: ChromeScriptStep[]): unknown[] {
  return steps.map((s) => {
    const o: Record<string, unknown> = { action: s.action };
    if (s.selector) o.selector = s.selector;
    if (s.selectorIndex != null && s.selectorIndex > 0) o.selectorIndex = s.selectorIndex;
    if (s.text != null && s.text !== '') o.text = s.text;
    if (s.action === 'delay' && s.ms != null) o.ms = s.ms;
    if (s.action === 'waitFor') {
      if (s.timeoutMs != null) o.timeoutMs = s.timeoutMs;
    }
    if (s.action === 'snapshotDom') {
      if (s.maxNodes != null) o.maxNodes = s.maxNodes;
      if (s.interactiveOnly != null) o.interactiveOnly = s.interactiveOnly;
    }
    return o;
  });
}

export function newChromeStep(action: ChromeScriptAction): ChromeScriptStep {
  const id = randomId();
  switch (action) {
    case 'click':
      return { id, action, selector: '' };
    case 'fill':
      return { id, action, selector: '', text: '' };
    case 'delay':
      return { id, action, ms: 500 };
    case 'waitFor':
      return { id, action, selector: '', timeoutMs: 10000 };
    case 'snapshotDom':
      return { id, action, maxNodes: 200, interactiveOnly: false };
    default:
      return { id, action: 'delay', ms: 500 };
  }
}

export function summarizeStep(step: ChromeScriptStep): string {
  switch (step.action) {
    case 'click':
      return step.selector?.trim() || '—';
    case 'fill':
      return `${step.selector?.trim() || '—'} → "${(step.text ?? '').slice(0, 40)}"`;
    case 'delay':
      return `${step.ms ?? 0} ms`;
    case 'waitFor':
      return `${step.selector?.trim() || '—'} (${step.timeoutMs ?? 10000} ms)`;
    case 'snapshotDom':
      return `maxNodes=${step.maxNodes ?? 200}`;
    default:
      return step.action;
  }
}

export function actionLabel(action: ChromeScriptAction): string {
  return t(`chromeScriptStep.action_${action}` as 'chromeScriptStep.action_click');
}

export function validateSteps(steps: ChromeScriptStep[]): string | null {
  if (steps.length === 0) {
    return t('chromeScripts.stepsRequired');
  }
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.action === 'click' || s.action === 'fill' || s.action === 'waitFor') {
      if (!s.selector?.trim()) {
        return t('chromeScriptStep.selectorRequired', { index: String(i + 1) });
      }
    }
    if (s.action === 'fill' && s.text == null) {
      return t('chromeScriptStep.textRequired', { index: String(i + 1) });
    }
    if (s.action === 'delay' && (s.ms == null || s.ms < 100)) {
      return t('chromeScriptStep.delayMin', { index: String(i + 1) });
    }
  }
  return null;
}

export function parseChromeStepsDocument(
  text: string,
): { steps: ChromeScriptStep[] } | { error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { error: t('templateWizard.chromeJsonEmpty') };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { error: t('templateWizard.chromeJsonInvalid') };
  }

  let raw: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    raw = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { steps?: unknown[] }).steps)
  ) {
    raw = (parsed as { steps: unknown[] }).steps;
  }

  if (!raw) {
    return { error: t('templateWizard.chromeJsonShape') };
  }

  const steps = parseStepsFromJson(raw);
  if (steps.length === 0) {
    return { error: t('templateWizard.chromeJsonNoSteps') };
  }
  return { steps };
}

export function chromeStepsDocumentText(
  steps: ChromeScriptStep[],
  urlPattern?: string,
): string {
  const doc: Record<string, unknown> = { steps: stepsToJson(steps) };
  if (urlPattern?.trim()) {
    doc.urlPattern = urlPattern.trim();
  }
  return JSON.stringify(doc, null, 2);
}

export const CHROME_STEPS_MAX = 200;

export const CHROME_STEP_PALETTE: {
  action: ChromeScriptAction;
  iconName: 'MousePointer2' | 'Keyboard' | 'Clock' | 'Eye' | 'Camera';
}[] = [
  { action: 'click', iconName: 'MousePointer2' },
  { action: 'fill', iconName: 'Keyboard' },
  { action: 'delay', iconName: 'Clock' },
  { action: 'waitFor', iconName: 'Eye' },
  { action: 'snapshotDom', iconName: 'Camera' },
];
