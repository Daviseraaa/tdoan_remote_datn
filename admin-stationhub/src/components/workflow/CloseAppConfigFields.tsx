import { AppWindow } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  type CloseAppFormState,
  type CloseAppMode,
  parseCloseAppForm,
  buildCloseAppTask,
} from '@/src/lib/closeAppPayload';
import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm font-mono';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

const MODES: CloseAppMode[] = ['openedInRun', 'pid', 'processName', 'windowTitle'];

type Props = {
  payload?: Record<string, unknown> | null;
  onChange: (patch: { command: string; payload: Record<string, unknown> }) => void;
  compact?: boolean;
};

export function CloseAppConfigFields({ payload, onChange, compact }: Props) {
  const form = parseCloseAppForm(payload);

  const emit = (next: CloseAppFormState) => {
    onChange(buildCloseAppTask(next));
  };

  const patch = (p: Partial<CloseAppFormState>) => emit({ ...form, ...p });

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border border-white/5 bg-surface-container-low/30 p-4')}>
      {!compact ? (
        <div className="flex items-center gap-3">
          <AppWindow size={20} className="text-error shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-on-surface">{t('taskType.CLOSE_APP')}</h4>
            <p className="text-xs text-on-surface-variant">{t('closeApp.subtitle')}</p>
          </div>
        </div>
      ) : null}

      <div>
        <label className={labelCls}>{t('closeApp.mode')}</label>
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
              {t(`closeApp.mode_${m}` as 'closeApp.mode_pid')}
            </button>
          ))}
        </div>
      </div>

      {form.mode === 'pid' ? (
        <div>
          <label className={labelCls}>{t('closeApp.pid')}</label>
          <input
            value={form.pid}
            onChange={(e) => patch({ pid: e.target.value })}
            placeholder="{{steps.open_app.json.pid}}"
            className={inputCls}
          />
          {!compact ? (
            <p className="text-[10px] text-on-surface-variant mt-1">{t('closeApp.pidHint')}</p>
          ) : null}
        </div>
      ) : null}

      {form.mode === 'processName' ? (
        <div>
          <label className={labelCls}>{t('closeApp.processName')}</label>
          <input
            value={form.processName}
            onChange={(e) => patch({ processName: e.target.value })}
            placeholder="notepad"
            className={inputCls}
          />
        </div>
      ) : null}

      {form.mode === 'windowTitle' ? (
        <div>
          <label className={labelCls}>{t('closeApp.windowTitle')}</label>
          <input
            value={form.windowTitle}
            onChange={(e) => patch({ windowTitle: e.target.value })}
            placeholder="Untitled"
            className={inputCls}
          />
        </div>
      ) : null}

      {form.mode === 'openedInRun' && !compact ? (
        <p className="text-xs text-on-surface-variant">{t('closeApp.openedInRunHint')}</p>
      ) : null}
    </div>
  );
}
