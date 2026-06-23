import { actionLabel as chromeActionLabel, summarizeStep as summarizeChromeStep } from '@/src/lib/chromeScriptSteps';
import { t } from '@/src/i18n/t';
import type { ChromeScriptStep } from '@/src/lib/chromeScriptSteps';
import type { DesktopStep } from '@/src/lib/taskTemplatePayload';
import {
  buildChromePayloadFromStep,
  buildDesktopPayloadFromStep,
  chromeStepFromWfPayload,
  desktopStepsFromWfPayload,
} from '@/src/lib/workflowGraph';
import { ChromeScriptStepInspector } from '@/src/components/chromeScript/ChromeScriptStepInspector';
import { DesktopStepInspector } from '@/src/components/desktopRecording/DesktopStepInspector';

type DesktopProps = {
  payload: unknown;
  onPatch: (patch: {
    payload: Record<string, unknown>;
    command: string;
    timeout?: number;
  }) => void;
};

export function WfDesktopImportedStepFields({ payload, onPatch }: DesktopProps) {
  const steps = desktopStepsFromWfPayload(payload);
  const step = steps[0] ?? null;
  if (!step) return null;

  const applyStep = (patch: Partial<DesktopStep>) => {
    const next = { ...step, ...patch };
    onPatch({
      payload: buildDesktopPayloadFromStep(next),
      command: t('templateWizard.desktopStepCount', { count: '1' }),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-primary/90 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        {t('workflows.importedDesktopStepHint')}
      </p>
      <DesktopStepInspector step={step} onChange={applyStep} />
    </div>
  );
}

type ChromeProps = {
  payload: unknown;
  command?: string;
  timeout?: number;
  onPatch: (patch: {
    payload: Record<string, unknown>;
    command: string;
    timeout?: number;
  }) => void;
};

export function WfChromeImportedStepFields({ payload, command, timeout, onPatch }: ChromeProps) {
  const step = chromeStepFromWfPayload(payload);
  if (!step) return null;

  const p = (payload as Record<string, unknown> | undefined) ?? {};
  const urlPattern = typeof p.urlPattern === 'string' ? p.urlPattern : '';

  const applyStep = (patch: Partial<ChromeScriptStep>) => {
    const next = { ...step, ...patch };
    const nextTimeout =
      next.action === 'waitFor' ? (next.timeoutMs ?? 10_000) + 5_000 : timeout ?? 120_000;
    onPatch({
      payload: buildChromePayloadFromStep(next, urlPattern),
      command: command?.trim() && command.trim() !== '[]' ? command : '',
      timeout: nextTimeout,
    });
  };

  const applyUrlPattern = (nextUrl: string) => {
    onPatch({
      payload: buildChromePayloadFromStep(step, nextUrl),
      command: command?.trim() && command.trim() !== '[]' ? command : '',
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-primary/90 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        {t('workflows.importedChromeStepHint')}
      </p>
      <p className="text-xs font-mono text-on-surface-variant">
        {chromeActionLabel(step.action)}
        {summarizeChromeStep(step) ? ` · ${summarizeChromeStep(step)}` : ''}
      </p>
      <ChromeScriptStepInspector step={step} onChange={applyStep} />
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.chromeExtensionUrlPattern')}
        </label>
        <input
          type="text"
          value={urlPattern}
          onChange={(e) => applyUrlPattern(e.target.value)}
          placeholder="https://example.com/*"
          className="w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm"
        />
      </div>
    </div>
  );
}
