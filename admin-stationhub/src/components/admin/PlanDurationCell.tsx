import { planDurationSubLabel } from '@/src/lib/planDisplay';
import { t } from '@/src/i18n/t';

export function PlanDurationCell({ days }: { days: number }) {
  const sub = planDurationSubLabel(days);
  return (
    <div>
      <p className="font-mono font-bold">
        {days} {t('adminPortal.days')}
      </p>
      {sub ? (
        <p className="text-[10px] text-on-surface-variant mt-0.5">≈ {sub}</p>
      ) : null}
    </div>
  );
}
