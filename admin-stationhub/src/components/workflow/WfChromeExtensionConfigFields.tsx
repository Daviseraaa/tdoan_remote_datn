import {
  CHROME_STEP_PALETTE,
  actionLabel,
  newChromeStep,
} from '@/src/lib/chromeScriptSteps';
import { buildChromePayloadFromStep, chromeStepFromWfPayload } from '@/src/lib/workflowGraph';
import { ChromeScriptStepInspector } from '@/src/components/chromeScript/ChromeScriptStepInspector';
import { t } from '@/src/i18n/t';
import { cn } from '@/src/lib/utils';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm font-mono';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

type Props = {
  payload: unknown;
  onPatch: (patch: { payload: Record<string, unknown>; timeout?: number }) => void;
  timeout?: number;
};

export function WfChromeExtensionConfigFields({ payload, onPatch, timeout }: Props) {
  const p = (payload as Record<string, unknown> | undefined) ?? {};
  const urlPattern = typeof p.urlPattern === 'string' ? p.urlPattern : '';
  const step = chromeStepFromWfPayload(payload) ?? newChromeStep('snapshotDom');

  const emit = (next: ReturnType<typeof newChromeStep>, nextUrl = urlPattern) => {
    const nextTimeout =
      next.action === 'waitFor' ? (next.timeoutMs ?? 10_000) + 5_000 : timeout ?? 120_000;
    onPatch({
      payload: buildChromePayloadFromStep(next, nextUrl),
      timeout: nextTimeout,
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>{t('workflows.chromeExtensionAction')}</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {CHROME_STEP_PALETTE.map(({ action }) => (
            <button
              key={action}
              type="button"
              onClick={() => emit(newChromeStep(action))}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                step.action === action
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {actionLabel(action)}
            </button>
          ))}
        </div>
      </div>

      <ChromeScriptStepInspector
        step={step}
        onChange={(patch) => emit({ ...step, ...patch })}
      />

      <div>
        <label className={labelCls}>{t('workflows.chromeExtensionUrlPattern')}</label>
        <input
          type="text"
          value={urlPattern}
          onChange={(e) => emit(step, e.target.value)}
          placeholder="https://example.com/*"
          className={inputCls}
        />
      </div>
    </div>
  );
}
