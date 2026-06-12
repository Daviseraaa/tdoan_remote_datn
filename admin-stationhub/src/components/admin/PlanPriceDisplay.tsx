import { cn } from '@/src/lib/utils';
import {
  formatVnd,
  planDiscountPercent,
  planHasDiscount,
  planOriginalPrice,
} from '@/src/lib/planPricing';
import { t } from '@/src/i18n/t';
import type { SubscriptionPlan } from '@/src/types/api';

type Props = {
  plan: Pick<SubscriptionPlan, 'originalPriceVnd' | 'priceVnd' | 'isTrial'>;
  size?: 'sm' | 'md';
  className?: string;
  priceClassName?: string;
};

export function PlanPriceDisplay({ plan, size = 'sm', className, priceClassName }: Props) {
  if (plan.isTrial || plan.priceVnd <= 0) {
    return <span className={className}>{t('billing.freePrice')}</span>;
  }

  const onSale = planHasDiscount(plan);
  const pct = planDiscountPercent(plan);
  const saleCls = size === 'md' ? 'text-3xl sm:text-4xl font-bold' : 'font-mono font-bold';

  if (!onSale) {
    return (
      <span className={cn(saleCls, priceClassName, className)}>
        {formatVnd(plan.priceVnd)}
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-start gap-0.5', className)}>
      <span
        className={cn(
          'text-on-surface-variant/70 line-through font-mono',
          size === 'md' ? 'text-base sm:text-lg' : 'text-xs',
        )}
      >
        {formatVnd(planOriginalPrice(plan))}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={cn(saleCls, priceClassName)}>{formatVnd(plan.priceVnd)}</span>
        {pct != null ? (
          <span className="text-[10px] font-bold text-error px-1.5 py-0.5 rounded-full bg-error/15">
            {t('billing.discountPercent', { n: String(pct) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
