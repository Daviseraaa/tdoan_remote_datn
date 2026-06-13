import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { PlanPriceDisplay } from '@/src/components/admin/PlanPriceDisplay';
import { PlanDurationCell } from '@/src/components/admin/PlanDurationCell';
import { formatMaxAgents } from '@/src/lib/planDisplay';
import { normalizePlanBenefits } from '@/src/lib/planBenefits';
import { t } from '@/src/i18n/t';
import type { SubscriptionPlan } from '@/src/types/api';

function PlanBenefitsPreview({ plan }: { plan: SubscriptionPlan }) {
  const lines = normalizePlanBenefits(plan.benefits);
  if (lines.length === 0) {
    return (
      <span className="text-[10px] text-on-surface-variant italic">
        {t('adminPortal.benefitsDefault')}
      </span>
    );
  }
  return (
    <div className="space-y-0.5 min-w-0">
      <p className="text-[10px] font-bold text-on-surface-variant">
        {t('adminPortal.benefitsLines', { n: String(lines.length) })}
      </p>
      <ul className="text-xs text-on-surface-variant/90 space-y-0.5">
        {lines.slice(0, 2).map((line) => (
          <li key={line} className="line-clamp-2 break-words" title={line}>
            · {line}
          </li>
        ))}
        {lines.length > 2 ? (
          <li className="text-[10px] opacity-70">+{lines.length - 2}…</li>
        ) : null}
      </ul>
    </div>
  );
}

type Props = {
  plan: SubscriptionPlan;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
};

export function PlanCard({ plan, onEdit, onDelete, onToggleActive }: Props) {
  return (
    <article className="rounded-2xl border border-white/10 bg-surface-container-low/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-base leading-snug">{plan.name}</h3>
            {plan.isTrial ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-secondary-container/40 text-secondary border border-white/10 shrink-0">
                {t('adminPortal.trialPlan')}
              </span>
            ) : null}
          </div>
          {plan.description ? (
            <p className="text-xs text-on-surface-variant/80 mt-1 line-clamp-3 break-words">
              {plan.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
          <button
            type="button"
            onClick={onEdit}
            className="p-2.5 rounded-xl hover:bg-white/5 text-primary touch-manipulation"
            aria-label={t('common.edit')}
          >
            <Pencil size={18} />
          </button>
          {!plan.isTrial ? (
            <button
              type="button"
              onClick={onDelete}
              className="p-2.5 rounded-xl hover:bg-error/10 text-error touch-manipulation"
              aria-label={t('common.delete')}
            >
              <Trash2 size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <PlanPriceDisplay plan={plan} />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1">
            {t('adminPortal.duration')}
          </p>
          <PlanDurationCell days={plan.durationDays} />
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1">
            {t('adminPortal.maxAgents')}
          </p>
          <p className="font-mono font-bold text-sm">{formatMaxAgents(plan.maxAgents)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-1.5">
          {t('adminPortal.benefitsColumn')}
        </p>
        <PlanBenefitsPreview plan={plan} />
      </div>

      <div className="pt-0.5">
        {plan.isTrial ? (
          <span className="inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase bg-primary/15 text-primary">
            {t('adminPortal.planActive')}
          </span>
        ) : (
          <button
            type="button"
            onClick={onToggleActive}
            className={cn(
              'inline-flex px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase touch-manipulation',
              plan.isActive !== false
                ? 'bg-tertiary/20 text-tertiary'
                : 'bg-white/10 text-on-surface-variant',
            )}
          >
            {plan.isActive !== false
              ? t('adminPortal.planActive')
              : t('adminPortal.planInactive')}
          </button>
        )}
      </div>
    </article>
  );
}
