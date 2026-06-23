import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

type Props = {
  timeout?: number;
  priority?: number;
  onPatch: (patch: { timeout?: number; priority?: number }) => void;
};

export function WfTaskTimingFields({ timeout, priority, onPatch }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className={labelCls}>{t('tasks.timeoutMs')}</label>
        <input
          type="number"
          min={5000}
          value={timeout ?? 60000}
          onChange={(e) => onPatch({ timeout: Number(e.target.value) })}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>{t('tasks.priority')}</label>
        <input
          type="number"
          min={0}
          max={10}
          value={priority ?? 5}
          onChange={(e) => onPatch({ priority: Number(e.target.value) })}
          className={inputCls}
        />
        <p className="text-[10px] text-on-surface-variant/70 mt-1">{t('workflows.priorityHint')}</p>
      </div>
    </div>
  );
}
