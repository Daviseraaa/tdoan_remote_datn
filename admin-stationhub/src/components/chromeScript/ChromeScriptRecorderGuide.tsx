import { useState } from 'react';
import { ChevronDown, ChevronUp, Chrome, Circle } from 'lucide-react';
import { t } from '@/src/i18n/t';
import { cn } from '@/src/lib/utils';

type Props = {
  defaultOpen?: boolean;
  className?: string;
};

export function ChromeScriptRecorderGuide({ defaultOpen = true, className }: Props) {
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
          <Chrome size={20} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-on-surface text-sm">{t('chromeScripts.guideTitle')}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{t('chromeScripts.guideSubtitle')}</p>
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
            <li>{t('chromeScripts.guideStep1')}</li>
            <li>{t('chromeScripts.guideStep2')}</li>
            <li>{t('chromeScripts.guideStep3')}</li>
            <li>{t('chromeScripts.guideStep4')}</li>
            <li>{t('chromeScripts.guideStep5')}</li>
          </ol>
          <div className="rounded-lg bg-[#0b0f14] border border-white/10 px-4 py-3 text-xs text-[#d4d4d4] space-y-3">
            <div>
              <p className="text-on-surface-variant/80 mb-1 font-medium">
                {t('chromeScripts.guideBuildLabel')}
              </p>
              <p className="text-on-surface-variant leading-relaxed">
                {t('chromeScripts.guideInstallDetail')}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant/80 mb-1 font-medium">
                {t('chromeScripts.guideExtensionLabel')}
              </p>
              <p className="text-on-surface-variant leading-relaxed">
                {t('chromeScripts.guideExtensionDetail')}
              </p>
            </div>
          </div>
          <p className="text-amber-300/90 text-xs flex items-start gap-2">
            <Circle size={8} className="fill-current shrink-0 mt-1" />
            {t('chromeScripts.guideNote')}
          </p>
          <p className={cn('text-xs text-on-surface-variant')}>{t('chromeScripts.guidePath')}</p>
        </div>
      ) : null}
    </div>
  );
}
