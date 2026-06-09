import { useState } from 'react';
import { ChevronDown, ChevronUp, Circle, Terminal } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

type Props = {
  defaultOpen?: boolean;
  className?: string;
};

export function DesktopRecorderGuide({ defaultOpen = true, className }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        'rounded-xl border border-white/5 bg-surface-container-low/40 overflow-hidden',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Terminal size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-sm">{t('desktopRecordings.guideTitle')}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{t('desktopRecordings.guideSubtitle')}</p>
        </div>
        {open ? (
          <ChevronUp size={18} className="text-on-surface-variant shrink-0" />
        ) : (
          <ChevronDown size={18} className="text-on-surface-variant shrink-0" />
        )}
      </button>
      {open ? (
        <div className="px-5 pb-5 pt-0 border-t border-white/5 space-y-4">
          <ol className="space-y-2 text-sm text-on-surface-variant list-decimal list-inside">
            <li>{t('desktopRecordings.guideStep1')}</li>
            <li>{t('desktopRecordings.guideStep2')}</li>
            <li>{t('desktopRecordings.guideStep3')}</li>
            <li>{t('desktopRecordings.guideStep4')}</li>
            <li>{t('desktopRecordings.guideStep5')}</li>
          </ol>
          <div className="rounded-lg bg-[#0b0f14] border border-white/10 px-4 py-3 font-mono text-xs text-[#d4d4d4] space-y-3">
            <div>
              <p className="text-on-surface-variant/80 mb-1">{t('desktopRecordings.guideGuiLabel')}</p>
              <code>stationhub-desktop-recorder.exe</code>
              <span className="text-on-surface-variant"> — double-click hoặc chạy không tham số</span>
            </div>
            <div>
              <p className="text-on-surface-variant/80 mb-1">{t('desktopRecordings.guideCmdLabel')}</p>
              <code>stationhub-desktop-recorder.exe record --name &quot;Ten ban ghi&quot;</code>
            </div>
            <p className="text-amber-300/90 flex items-center gap-2">
              <Circle size={8} className="fill-current" />
              {t('desktopRecordings.guideStopKey')}
            </p>
          </div>
          <p className={cn('text-xs text-on-surface-variant')}>{t('desktopRecordings.guidePath')}</p>
        </div>
      ) : null}
    </div>
  );
}
