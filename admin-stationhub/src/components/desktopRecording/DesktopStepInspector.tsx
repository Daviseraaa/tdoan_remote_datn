import React from 'react';
import { t } from '@/src/i18n/t';
import type { DesktopStep } from '@/src/lib/taskTemplatePayload';

type Props = {
  step: DesktopStep | null;
  onChange: (patch: Partial<DesktopStep>) => void;
  readOnly?: boolean;
};

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-surface-container-low border border-white/10 text-sm disabled:opacity-70 disabled:cursor-default';

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

export function DesktopStepInspector({ step, onChange, readOnly = false }: Props) {
  if (!step) {
    return (
      <p className="text-xs text-on-surface-variant">{t('desktopRecordings.selectStep')}</p>
    );
  }

  switch (step.action) {
    case 'delay':
      return (
        <Field label={t('templateWizard.field_ms')}>
          <input
            type="number"
            min={0}
            value={step.ms ?? 0}
            onChange={(e) => onChange({ ms: Number(e.target.value) })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      );
    case 'openApp':
      return (
        <Field label={t('templateWizard.field_target')}>
          <input
            value={step.target ?? ''}
            onChange={(e) => onChange({ target: e.target.value })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      );
    case 'move':
      return (
        <>
          <Field label={t('templateWizard.field_x')}>
            <input
              type="number"
              value={step.x ?? 0}
              onChange={(e) => onChange({ x: Number(e.target.value) })}
              className={inputCls}
            disabled={readOnly}
            />
          </Field>
          <Field label={t('templateWizard.field_y')}>
            <input
              type="number"
              value={step.y ?? 0}
              onChange={(e) => onChange({ y: Number(e.target.value) })}
              className={inputCls}
            disabled={readOnly}
            />
          </Field>
        </>
      );
    case 'click':
      return (
        <>
          <Field label={t('templateWizard.field_x')}>
            <input
              type="number"
              value={step.x ?? ''}
              placeholder="—"
              onChange={(e) =>
                onChange({ x: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
            disabled={readOnly}
            />
          </Field>
          <Field label={t('templateWizard.field_y')}>
            <input
              type="number"
              value={step.y ?? ''}
              placeholder="—"
              onChange={(e) =>
                onChange({ y: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
            disabled={readOnly}
            />
          </Field>
          <Field label={t('templateWizard.field_button')}>
            <select
              value={step.button ?? 'left'}
              onChange={(e) => onChange({ button: e.target.value as 'left' | 'right' })}
              className={inputCls}
            disabled={readOnly}
            >
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(step.double)}
              disabled={readOnly}
              onChange={(e) => onChange({ double: e.target.checked })}
            />
            {t('templateWizard.field_double')}
          </label>
        </>
      );
    case 'typeText':
      return (
        <Field label={t('templateWizard.field_text')}>
          <textarea
            value={step.text ?? ''}
            onChange={(e) => onChange({ text: e.target.value })}
            rows={4}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      );
    case 'keyCombo':
      return (
        <Field label={t('templateWizard.field_keys')}>
          <input
            value={step.keys ?? ''}
            onChange={(e) => onChange({ keys: e.target.value })}
            className={inputCls}
            disabled={readOnly}
          />
        </Field>
      );
    case 'scroll':
      return (
        <>
          <Field label={t('templateWizard.field_direction')}>
            <select
              value={step.direction ?? 'down'}
              onChange={(e) =>
                onChange({ direction: e.target.value as DesktopStep['direction'] })
              }
              className={inputCls}
            disabled={readOnly}
            >
              <option value="up">up</option>
              <option value="down">down</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </Field>
          <Field label={t('templateWizard.field_amount')}>
            <input
              type="number"
              min={1}
              value={step.amount ?? 3}
              onChange={(e) => onChange({ amount: Number(e.target.value) })}
              className={inputCls}
            disabled={readOnly}
            />
          </Field>
        </>
      );
    default:
      return null;
  }
}
