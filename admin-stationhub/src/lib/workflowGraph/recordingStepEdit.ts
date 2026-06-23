import { parseStepsFromJson as parseChromeSteps } from '@/src/lib/chromeScriptSteps';
import type { ChromeScriptStep } from '@/src/lib/chromeScriptSteps';
import { parseStepsFromJson as parseDesktopSteps } from '@/src/lib/desktopRecordingSteps';
import {
  serializeDesktopStep,
  type DesktopStep,
} from '@/src/lib/taskTemplatePayload';

export function desktopStepsFromWfPayload(payload: unknown): DesktopStep[] {
  const p = payload as Record<string, unknown> | null | undefined;
  if (!p || !Array.isArray(p.steps) || p.steps.length === 0) return [];
  return parseDesktopSteps(p.steps);
}

export function chromeStepFromWfPayload(payload: unknown): ChromeScriptStep | null {
  const p = payload as Record<string, unknown> | null | undefined;
  if (!p || typeof p.action !== 'string') return null;
  const steps = parseChromeSteps([p]);
  return steps[0] ?? null;
}

/** Một bước Chrome lưu trong payload.action (import recorder / thêm từ palette). */
export function isChromePayloadStepMode(payload: unknown): boolean {
  return chromeStepFromWfPayload(payload) != null;
}

export function buildDesktopPayloadFromStep(step: DesktopStep): Record<string, unknown> {
  return { steps: [serializeDesktopStep(step)] };
}

export function buildChromePayloadFromStep(
  step: ChromeScriptStep,
  urlPattern?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    action: step.action,
    maxNodes: step.maxNodes ?? 200,
  };
  const pattern = urlPattern?.trim();
  if (pattern) payload.urlPattern = pattern;
  if (step.selector != null) payload.selector = step.selector;
  if (step.selectorIndex != null && step.selectorIndex > 0) {
    payload.selectorIndex = step.selectorIndex;
  }
  if (step.action === 'fill') payload.text = step.text ?? '';
  if (step.action === 'waitFor' && step.timeoutMs != null) {
    payload.timeoutMs = step.timeoutMs;
  }
  if (step.action === 'snapshotDom' && step.interactiveOnly != null) {
    payload.interactiveOnly = step.interactiveOnly;
  }
  return payload;
}
