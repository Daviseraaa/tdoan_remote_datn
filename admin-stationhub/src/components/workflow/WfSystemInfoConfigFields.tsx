import { Info } from 'lucide-react';
import { t } from '@/src/i18n/t';

export function WfSystemInfoConfigFields() {
  return (
    <p className="text-xs text-on-surface-variant rounded-xl border border-tertiary/20 bg-tertiary/5 px-3 py-2.5 flex gap-2">
      <Info size={16} className="text-tertiary shrink-0 mt-0.5" />
      <span>{t('templateWizard.systemInfoHint')}</span>
    </p>
  );
}
