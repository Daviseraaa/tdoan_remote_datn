import React from 'react';
import { cn } from '@/src/lib/utils';
import { getPlanTierStyle, type PlanTierId } from '@/src/lib/planTier';
import { t } from '@/src/i18n/t';

type Props = {
  tier: PlanTierId;
  planName?: string | null;
  className?: string;
  showTierLabel?: boolean;
};

export function PlanTierChip({
  tier,
  planName,
  className,
  showTierLabel = true,
}: Props) {
  const style = getPlanTierStyle(tier);
  const Icon = style.Icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0',
        style.tierBadge,
        style.tierBadgeText,
        className,
      )}
      title={planName ?? t(style.labelKey)}
    >
      <Icon size={12} className="shrink-0" />
      {showTierLabel ? (
        <span className="truncate">{t(style.labelKey)}</span>
      ) : null}
      {planName ? (
        <span className="truncate opacity-90">
          {showTierLabel ? '· ' : ''}
          {planName}
        </span>
      ) : null}
    </span>
  );
}
