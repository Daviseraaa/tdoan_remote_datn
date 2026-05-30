import React from 'react';
import { t } from '@/src/i18n/t';
import type { ChromeScriptStep } from '@/src/lib/chromeScriptSteps';

type Props = {
  step: ChromeScriptStep | null;
  onChange: (patch: Partial<ChromeScriptStep>) => void;
  readOnly?: boolean;
};

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-surface-container-low border border-white/10 text-sm font-mono disabled:opacity-70 disabled:cursor-default';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ChromeScriptStepInspector({ step, onChange, readOnly = false }: Props) {
  if (!step) {
    return (
      <p className="text-xs text-on-surface-variant">{t('chromeScripts.selectStep')}</p>
    );
  }

  const needsSelector =
    step.action === 'click' || step.action === 'fill' || step.action === 'waitFor';

  return (
    <div className="space-y-1">
      {needsSelector ? (
        <>
          <Field label={t('chromeScriptStep.field_selector')}>
            <input
              value={step.selector ?? ''}
              onChange={(e) => onChange({ selector: e.target.value })}
              className={inputCls}
              disabled={readOnly}
              placeholder="button.submit"
            />
          </Field>
          <Field label={t('chromeScriptStep.field_selectorIndex')}>
            <input
              type="number"
              min={0}
              value={step.selectorIndex ?? ''}
              placeholder="0"
              onChange={(e) =>
                onChange({
                  selectorIndex:
                    e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
        </>
      ) : null}

      {step.action === 'fill' ? (
        <Field label={t('chromeScriptStep.field_text')}>
          <input
            value={step.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      ) : null}

      {step.action === 'delay' ? (
        <Field label={t('chromeScriptStep.field_ms')}>
          <input
            type="number"
            min={100}
            max={30000}
            value={step.ms ?? 500}
            onChange={(e) => onChange({ ms: Number(e.target.value) })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      ) : null}

      {step.action === 'waitFor' ? (
        <Field label={t('chromeScriptStep.field_timeoutMs')}>
          <input
            type="number"
            min={1000}
            max={120000}
            value={step.timeoutMs ?? 10000}
            onChange={(e) => onChange({ timeoutMs: Number(e.target.value) })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      ) : null}

      {step.action === 'snapshotDom' ? (
        <>
          <Field label={t('chromeScriptStep.field_maxNodes')}>
            <input
              type="number"
              min={1}
              max={2000}
              value={step.maxNodes ?? 200}
              onChange={(e) => onChange({ maxNodes: Number(e.target.value) })}
              className={inputCls}
              disabled={readOnly}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={step.interactiveOnly === true}
              disabled={readOnly}
              onChange={(e) => onChange({ interactiveOnly: e.target.checked })}
            />
            {t('chromeScriptStep.field_interactiveOnly')}
          </label>
        </>
      ) : null}
    </div>
  );
}
