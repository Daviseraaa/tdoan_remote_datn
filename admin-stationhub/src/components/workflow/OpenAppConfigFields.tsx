import { AppWindow } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  type OpenAppFormState,
  type OpenAppLaunchMode,
  parseOpenAppForm,
  buildOpenAppTask,
} from '@/src/lib/openAppPayload';
import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm font-mono';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

const MODES: OpenAppLaunchMode[] = ['path', 'app', 'query'];

type Props = {
  command: string;
  payload?: Record<string, unknown> | null;
  onChange: (patch: { command: string; payload: Record<string, unknown> }) => void;
  compact?: boolean;
};

export function OpenAppConfigFields({ command, payload, onChange, compact }: Props) {
  const form = parseOpenAppForm(command, payload);

  const emit = (next: OpenAppFormState) => {
    onChange(buildOpenAppTask(next));
  };

  const patch = (p: Partial<OpenAppFormState>) => emit({ ...form, ...p });

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border border-white/5 bg-surface-container-low/30 p-4')}>
      {!compact ? (
        <div className="flex items-center gap-3">
          <AppWindow size={20} className="text-primary shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-on-surface">{t('taskType.OPEN_APP')}</h4>
            <p className="text-xs text-on-surface-variant">{t('openApp.subtitle')}</p>
          </div>
        </div>
      ) : null}

      <div>
        <label className={labelCls}>{t('workflows.openAppMode')}</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patch({ mode: m })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                form.mode === m
                  ? 'bg-primary/15 border-primary/40 text-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(`templateWizard.openApp${m === 'path' ? 'Path' : m === 'app' ? 'App' : 'Query'}` as 'templateWizard.openAppPath')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('openApp.target')}</label>
        <input
          value={form.value}
          onChange={(e) => patch({ value: e.target.value })}
          placeholder={t(
            `templateWizard.openApp${form.mode === 'path' ? 'Path' : form.mode === 'app' ? 'App' : 'Query'}Ph` as 'templateWizard.openAppPathPh',
          )}
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-on-surface-variant">
        <input
          type="checkbox"
          checked={form.fullscreen}
          onChange={(e) => patch({ fullscreen: e.target.checked })}
          className="rounded"
        />
        {t('openApp.fullscreen')}
      </label>
      <p className="text-[10px] text-on-surface-variant -mt-2">{t('openApp.fullscreenHint')}</p>
    </div>
  );
}
