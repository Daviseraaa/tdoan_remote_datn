import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { OpenAppMode } from '@/src/lib/taskTemplatePayload';

const MODES: {
  id: OpenAppMode;
  labelKey: 'templateWizard.openAppPath' | 'templateWizard.openAppApp' | 'templateWizard.openAppQuery';
  phKey: 'templateWizard.openAppPathPh' | 'templateWizard.openAppAppPh' | 'templateWizard.openAppQueryPh';
}[] = [
  { id: 'path', labelKey: 'templateWizard.openAppPath', phKey: 'templateWizard.openAppPathPh' },
  { id: 'app', labelKey: 'templateWizard.openAppApp', phKey: 'templateWizard.openAppAppPh' },
  { id: 'query', labelKey: 'templateWizard.openAppQuery', phKey: 'templateWizard.openAppQueryPh' },
];

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm';

type Props = {
  mode: OpenAppMode;
  value: string;
  reuseExisting: boolean;
  maximizeWindow: boolean;
  onChange: (
    mode: OpenAppMode,
    value: string,
    reuseExisting: boolean,
    maximizeWindow: boolean,
  ) => void;
  className?: string;
};

export function WfOpenAppConfigFields({
  mode,
  value,
  reuseExisting,
  maximizeWindow,
  onChange,
  className,
}: Props) {
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.openAppMode')}
        </label>
        <div className="flex flex-wrap gap-2 mt-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id, value, reuseExisting, maximizeWindow)}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-bold border transition-all',
                mode === m.id
                  ? 'bg-primary text-on-primary border-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(m.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t(active.labelKey)}
        </label>
        <input
          value={value}
          onChange={(e) => onChange(mode, e.target.value, reuseExisting, maximizeWindow)}
          placeholder={t(active.phKey)}
          className={inputCls}
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-on-surface-variant">
        <input
          type="checkbox"
          checked={reuseExisting}
          onChange={(e) => onChange(mode, value, e.target.checked, maximizeWindow)}
          className="h-4 w-4 rounded border-white/15 bg-surface-container-low"
        />
        <span>{t('openApp.reuseExisting')}</span>
      </label>
      <label className="flex items-center gap-2 text-sm text-on-surface-variant">
        <input
          type="checkbox"
          checked={maximizeWindow}
          onChange={(e) => onChange(mode, value, reuseExisting, e.target.checked)}
          className="h-4 w-4 rounded border-white/15 bg-surface-container-low"
        />
        <span>{t('openApp.maximizeWindow')}</span>
      </label>
    </div>
  );
}
