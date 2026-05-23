import React from 'react';
import { t } from '@/src/i18n/t';

type Props = {
  timeout: number;
  priority: number;
  onChange: (patch: { timeout?: number; priority?: number }) => void;
};

export function TemplateAdvancedFields({ timeout, priority, onChange }: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 text-left text-sm font-bold text-on-surface-variant hover:bg-white/5"
      >
        {t('templateWizard.advanced')} {open ? '▾' : '▸'}
      </button>
      {open ? (
        <div className="grid grid-cols-2 gap-4 p-4 border-t border-white/5">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.timeoutMs')}
            </label>
            <input
              type="number"
              min={5000}
              value={timeout}
              onChange={(e) => onChange({ timeout: Number(e.target.value) })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.priority')}
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={priority}
              onChange={(e) => onChange({ priority: Number(e.target.value) })}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
