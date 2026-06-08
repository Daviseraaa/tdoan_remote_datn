import type { Agent, CreateTaskTemplateDto, TaskTemplate, TaskType } from '@/src/types/api';
import {
  parseStepsFromJson as parseChromeStepsFromJson,
  stepsToJson as chromeStepsToJson,
  validateSteps as validateChromeSteps,
  type ChromeScriptStep,
} from '@/src/lib/chromeScriptSteps';
import { parseStepsFromJson } from '@/src/lib/desktopRecordingSteps';
import { t } from '@/src/i18n/t';
import { randomId } from '@/src/lib/randomId';
import {
  buildHttpRequestPayload,
  parseHttpRequestPayload,
  validateHttpHeadersJson,
  type HttpMethod,
} from '@/src/lib/httpRequest';

export type { ChromeScriptStep };

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
  chromeSteps: ChromeScriptStep[];
  chromeUrlPattern: string;
  screenMonitor: number;
  screenIncludeBase64: boolean;
  screenSavePath: string;
  screenSaveToFile: boolean;
  screenSendTelegram: boolean;
  screenOnlySendTelegram: boolean;
  screenTelegramBotId: string;
  screenTelegramChatId: string;
  screenTelegramCaption: string;
  screenTelegramSendAs: 'photo' | 'document';
  screenTelegramFileName: string;
  httpMethod: HttpMethod;
  httpHeadersJson: string;
  httpBody: string;
  timeout: number;
  priority: number;
}

export const DESKTOP_STEPS_MAX = 200;
export const CHROME_STEPS_MAX = 200;

export const SELECTABLE_TEMPLATE_TYPES: TaskType[] = [
  'COMMAND',
  'SCRIPT',
  'SYSTEM_INFO',
  'OPEN_APP',
  'OPEN_BROWSER',
  'CHROME_EXTENSION',
  'DESKTOP_AUTOMATION',
  'SCREEN_CAPTURE',
  'HTTP_REQUEST',
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
  chromeSteps: [],
  chromeUrlPattern: '',
  screenMonitor: 0,
  screenIncludeBase64: true,
  screenSavePath: '',
  screenSaveToFile: true,
  screenSendTelegram: false,
  screenOnlySendTelegram: false,
  screenTelegramBotId: '',
  screenTelegramChatId: '{{telegram.chatId}}',
  screenTelegramCaption: '',
  screenTelegramSendAs: 'photo',
  screenTelegramFileName: 'screenshot.png',
  httpMethod: 'GET',
  httpHeadersJson: '{}',
  httpBody: '',
  timeout: 60000,
  priority: 5,
};

export function isWindowsAgent(os?: string): boolean {
  return (os ?? '').toLowerCase().includes('win');
}

export function newDesktopStep(action: DesktopAction): DesktopStep {
  const base = { id: randomId(), action };
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

export function serializeDesktopStep(step: DesktopStep): Record<string, unknown> {
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
  return parseStepsFromJson(raw);
}

function parseChromeStepsFromTemplate(tpl: TaskTemplate): {
  steps: ChromeScriptStep[];
  urlPattern: string;
} {
  let raw: unknown[] | null = null;
  const p = tpl.payload as Record<string, unknown> | null | undefined;
  if (p && Array.isArray(p.steps)) raw = p.steps;
  const cmd = (tpl.command ?? '').trim();
  if (!raw && cmd.startsWith('[')) {
    try {
      const v = JSON.parse(cmd) as unknown;
      if (Array.isArray(v)) raw = v;
    } catch {
      raw = null;
    }
  }
  const urlPattern =
    p && typeof p.urlPattern === 'string'
      ? p.urlPattern
      : p && typeof p.startUrl === 'string'
        ? p.startUrl
        : '';
  return {
    steps: parseChromeStepsFromJson(raw ?? []),
    urlPattern,
  };
}

export function chromeStepsFromTaskTemplate(tpl: TaskTemplate) {
  return parseChromeStepsFromTemplate(tpl);
}

export function desktopStepsFromTaskTemplate(tpl: TaskTemplate): DesktopStep[] {
  return parseDesktopStepsFromTemplate(tpl);
}

export function formatTemplateCommandPreview(
  tpl: Pick<TaskTemplate, 'type' | 'command' | 'payload'>,
): string {
  if (tpl.type === 'DESKTOP_AUTOMATION') {
    const p = tpl.payload as { steps?: unknown[] } | null | undefined;
    if (Array.isArray(p?.steps) && p.steps.length > 0) {
      const n = p.steps.length;
      const first = p.steps[0] as Record<string, unknown> | undefined;
      const action = first?.action ? String(first.action) : '';
      if (action) {
        const steps = parseStepsFromJson(p.steps);
        const summary = steps[0] ? summarizeDesktopStep(steps[0]) : '';
        return summary ? `${n} bước · ${action}: ${summary}` : `${n} bước · ${action}…`;
      }
      return t('templateWizard.desktopStepCount', { count: String(n) });
    }
    const cmd = (tpl.command ?? '').trim();
    if (cmd && cmd !== '[]') return cmd;
    return '—';
  }
  if (tpl.type === 'CHROME_EXTENSION') {
    const p = tpl.payload as { steps?: unknown[]; urlPattern?: string } | null | undefined;
    if (Array.isArray(p?.steps) && p.steps.length > 0) {
      const n = p.steps.length;
      const first = p.steps[0] as Record<string, unknown> | undefined;
      const action = first?.action ? String(first.action) : '';
      const url = p?.urlPattern ? ` · ${p.urlPattern}` : '';
      return action
        ? `${n} bước · ${action}${url}`
        : `${t('templateWizard.desktopStepCount', { count: String(n) })}${url}`;
    }
    const cmd = (tpl.command ?? '').trim();
    if (cmd.startsWith('[')) {
      try {
        const arr = JSON.parse(cmd) as unknown[];
        if (Array.isArray(arr) && arr.length > 0) {
          return t('templateWizard.desktopStepCount', { count: String(arr.length) });
        }
      } catch {
        /* fall through */
      }
    }
    if (cmd && !cmd.startsWith('[')) return cmd;
    return '—';
  }
  if (tpl.type === 'SYSTEM_INFO') return 'collect';
  if (tpl.type === 'HTTP_REQUEST') {
    const p = tpl.payload as { method?: string } | null | undefined;
    const method = (p?.method ?? 'GET').toUpperCase();
    const url = tpl.command?.trim() || '—';
    return `${method} ${url}`;
  }
  return tpl.command?.trim() || '—';
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
    chromeSteps: [],
    chromeUrlPattern: '',
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

  if (tpl.type === 'CHROME_EXTENSION') {
    const chrome = parseChromeStepsFromTemplate(tpl);
    base.chromeSteps = chrome.steps;
    base.chromeUrlPattern = chrome.urlPattern;
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

  if (tpl.type === 'HTTP_REQUEST') {
    const http = parseHttpRequestPayload(tpl.payload as Record<string, unknown> | null);
    base.httpMethod = http.method;
    base.httpHeadersJson = http.headersJson;
    base.httpBody = http.body;
    const p = tpl.payload as { url?: string } | null;
    if (p?.url && typeof p.url === 'string') base.command = p.url;
    return base;
  }

  if (tpl.type === 'SCREEN_CAPTURE') {
    const p = tpl.payload as Record<string, unknown> | null;
    if (p?.monitor != null) base.screenMonitor = Number(p.monitor);
    if (typeof p?.includeBase64 === 'boolean') base.screenIncludeBase64 = p.includeBase64;
    if (typeof p?.savePath === 'string') base.screenSavePath = p.savePath;
    if (typeof p?.saveToFile === 'boolean') base.screenSaveToFile = p.saveToFile;
    if (typeof p?.sendTelegram === 'boolean') base.screenSendTelegram = p.sendTelegram;
    if (typeof p?.onlySendTelegram === 'boolean') base.screenOnlySendTelegram = p.onlySendTelegram;
    if (typeof p?.telegramBotId === 'string') base.screenTelegramBotId = p.telegramBotId;
    if (typeof p?.chatId === 'string') base.screenTelegramChatId = p.chatId;
    if (typeof p?.caption === 'string') base.screenTelegramCaption = p.caption;
    if (p?.telegramSendAs === 'document' || p?.telegramSendAs === 'photo') {
      base.screenTelegramSendAs = p.telegramSendAs;
    }
    if (typeof p?.telegramFileName === 'string') base.screenTelegramFileName = p.telegramFileName;
    if (tpl.command?.trim()) base.screenMonitor = Number(tpl.command) || 0;
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
    case 'CHROME_EXTENSION': {
      const payload: Record<string, unknown> = {
        steps: chromeStepsToJson(state.chromeSteps),
      };
      const urlPattern = state.chromeUrlPattern.trim();
      if (urlPattern) payload.urlPattern = urlPattern;
      const n = state.chromeSteps.length;
      return {
        ...base,
        command: t('templateWizard.desktopStepCount', { count: String(n) }),
        payload,
      };
    }
    case 'DESKTOP_AUTOMATION': {
      const payload = desktopStepsToPayload(state.desktopSteps);
      const n = state.desktopSteps.length;
      return {
        ...base,
        command: t('templateWizard.desktopStepCount', { count: String(n) }),
        payload,
      };
    }
    case 'HTTP_REQUEST':
      return {
        ...base,
        command: state.command.trim() || 'https://example.com/api',
        payload: buildHttpRequestPayload(
          state.httpMethod,
          state.httpHeadersJson,
          state.httpBody,
        ),
      };
    case 'SCREEN_CAPTURE': {
      const onlySend = state.screenOnlySendTelegram;
      const saveToFile = onlySend ? false : state.screenSaveToFile;
      return {
        ...base,
        command: String(state.screenMonitor),
        payload: {
          monitor: state.screenMonitor,
          includeBase64: state.screenIncludeBase64,
          saveToFile,
          sendTelegram: state.screenSendTelegram,
          onlySendTelegram: onlySend,
          ...(state.screenSendTelegram
            ? {
                telegramBotId: state.screenTelegramBotId || undefined,
                chatId: state.screenTelegramChatId || undefined,
                caption: state.screenTelegramCaption || undefined,
                telegramSendAs: state.screenTelegramSendAs,
                ...(state.screenTelegramSendAs === 'document'
                  ? { telegramFileName: state.screenTelegramFileName.trim() || 'screenshot.png' }
                  : {}),
              }
            : {}),
          ...(saveToFile && state.screenSavePath.trim()
            ? { savePath: state.screenSavePath.trim() }
            : {}),
        },
      };
    }
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
    case 'CHROME_EXTENSION': {
      const err = validateChromeSteps(state.chromeSteps);
      if (err) return err;
      if (state.chromeSteps.length > CHROME_STEPS_MAX) {
        return t('templateWizard.chromeStepsMax', { max: String(CHROME_STEPS_MAX) });
      }
      break;
    }
    case 'DESKTOP_AUTOMATION':
      if (state.desktopSteps.length === 0) return t('templateWizard.desktopStepsRequired');
      if (state.desktopSteps.length > DESKTOP_STEPS_MAX) {
        return t('templateWizard.desktopStepsMax', { max: String(DESKTOP_STEPS_MAX) });
      }
      break;
    case 'HTTP_REQUEST': {
      if (!state.command.trim()) return t('httpRequest.urlRequired');
      const headerErr = validateHttpHeadersJson(state.httpHeadersJson);
      if (headerErr) return headerErr;
      break;
    }
    case 'SCREEN_CAPTURE':
      if (!isWindowsAgent(state.agent?.os)) return t('screenCapture.windowsOnly');
      if (state.screenSendTelegram) {
        if (!state.screenTelegramBotId.trim()) return t('screenCapture.botRequired');
        if (!state.screenTelegramChatId.trim()) return t('screenCapture.chatRequired');
      }
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
