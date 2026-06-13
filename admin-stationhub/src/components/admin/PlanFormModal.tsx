import React from 'react';
import { cn } from '@/src/lib/utils';
import { formatVnd, planDiscountPercent, planHasDiscount } from '@/src/lib/planPricing';
import { PLAN_DURATION_PRESETS } from '@/src/lib/planDisplay';
import { t } from '@/src/i18n/t';
import type { SubscriptionPlan } from '@/src/types/api';

export type PlanFormState = {
  name: string;
  originalPriceVnd: number;
  priceVnd: number;
  durationDays: number;
  maxAgents: number;
  description: string;
  benefitsText: string;
  isActive: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  form: PlanFormState;
  editPlan: SubscriptionPlan | null;
  error: string;
  isPending: boolean;
  onChange: (patch: Partial<PlanFormState>) => void;
  onClose: () => void;
  onSave: () => void;
};

const FIELD_LABEL =
  'block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant';

const FIELD_INPUT =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm disabled:opacity-50';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant/90 pt-1">
      {children}
    </p>
  );
}

export function PlanFormModal({
  mode,
  form,
  editPlan,
  error,
  isPending,
  onChange,
  onClose,
  onSave,
}: Props) {
  const isTrial = editPlan?.isTrial === true;
  const discountPct =
    !isTrial && planHasDiscount(form)
      ? planDiscountPercent({
          originalPriceVnd: form.originalPriceVnd,
          priceVnd: form.priceVnd,
        })
      : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-white/10 max-h-[min(92dvh,720px)] flex flex-col">
        <div className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
          <h3 className="text-lg font-bold pr-8">
            {mode === 'create' ? t('adminPortal.addPlan') : t('adminPortal.editPlan')}
          </h3>
          {editPlan?.isTrial ? (
            <p className="text-xs text-on-surface-variant mt-1">{t('adminPortal.trialPlanHint')}</p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-4 space-y-5 overscroll-contain">
          {error ? <p className="text-error text-sm">{error}</p> : null}

          <section className="space-y-3">
            <SectionTitle>{t('adminPortal.sectionBasic')}</SectionTitle>
            <div>
              <label className={FIELD_LABEL}>{t('common.name')}</label>
              <input
                className={FIELD_INPUT}
                value={form.name}
                onChange={(e) => onChange({ name: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>{t('adminPortal.description')}</label>
              <textarea
                className={cn(FIELD_INPUT, 'min-h-[72px] resize-y')}
                placeholder={t('adminPortal.descriptionPlaceholder')}
                value={form.description}
                onChange={(e) => onChange({ description: e.target.value })}
              />
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle>{t('adminPortal.sectionPricing')}</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>{t('adminPortal.originalPriceVnd')}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  className={FIELD_INPUT}
                  value={form.originalPriceVnd}
                  disabled={isTrial}
                  onChange={(e) =>
                    onChange({ originalPriceVnd: Number(e.target.value) || 0 })
                  }
                />
                {!isTrial && form.originalPriceVnd > 0 ? (
                  <p className="text-[10px] text-on-surface-variant/70 mt-1 font-mono">
                    {formatVnd(form.originalPriceVnd)}
                  </p>
                ) : null}
              </div>
              <div>
                <label className={FIELD_LABEL}>{t('adminPortal.salePriceVnd')}</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  className={FIELD_INPUT}
                  value={form.priceVnd}
                  disabled={isTrial}
                  onChange={(e) => onChange({ priceVnd: Number(e.target.value) || 0 })}
                />
                {!isTrial && form.priceVnd > 0 ? (
                  <p className="text-[10px] text-on-surface-variant/70 mt-1 font-mono">
                    {formatVnd(form.priceVnd)}
                  </p>
                ) : null}
              </div>
            </div>
            {discountPct != null ? (
              <p className="text-xs text-tertiary font-mono">
                {t('adminPortal.discountPreview', { n: String(discountPct) })}
              </p>
            ) : null}
            {form.originalPriceVnd < form.priceVnd && !isTrial ? (
              <p className="text-xs text-error">{t('adminPortal.priceOnSaleInvalid')}</p>
            ) : null}
          </section>

          <section className="space-y-3">
            <SectionTitle>{t('adminPortal.sectionLimits')}</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>{t('adminPortal.durationDays')}</label>
                <input
                  type="number"
                  min={1}
                  className={FIELD_INPUT}
                  value={form.durationDays}
                  onChange={(e) =>
                    onChange({ durationDays: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  {t('adminPortal.durationHint')}
                </p>
              </div>
              <div>
                <label className={FIELD_LABEL}>{t('adminPortal.maxAgents')}</label>
                <input
                  type="number"
                  min={1}
                  className={FIELD_INPUT}
                  value={form.maxAgents}
                  onChange={(e) =>
                    onChange({ maxAgents: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
                <p className="text-[10px] text-on-surface-variant/70 mt-1">
                  {t('adminPortal.maxAgentsHint')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
              {PLAN_DURATION_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ durationDays: days })}
                  className={cn(
                    'px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold border transition-colors touch-manipulation text-center',
                    form.durationDays === days
                      ? 'bg-primary/20 border-primary/40 text-primary'
                      : 'border-white/10 text-on-surface-variant hover:bg-white/5',
                  )}
                >
                  {t('adminPortal.durationPreset', { days: String(days) })}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className={FIELD_LABEL}>{t('adminPortal.planBenefits')}</label>
            <textarea
              className={cn(FIELD_INPUT, 'min-h-[120px] font-mono mt-1')}
              placeholder={t('adminPortal.planBenefitsPlaceholder')}
              value={form.benefitsText}
              onChange={(e) => onChange({ benefitsText: e.target.value })}
            />
            <p className="text-[11px] text-on-surface-variant/80 leading-snug">
              {t('adminPortal.planBenefitsHint')}
            </p>
          </section>

          <label className={cn('flex items-center gap-2 text-sm', isTrial && 'opacity-50')}>
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={isTrial}
              onChange={(e) => onChange({ isActive: e.target.checked })}
            />
            {t('adminPortal.planActive')}
          </label>
        </div>

        <div className="shrink-0 flex flex-col-reverse sm:flex-row gap-3 px-4 sm:px-6 py-4 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm touch-manipulation"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={isPending || !form.name.trim() || form.originalPriceVnd < form.priceVnd}
            onClick={onSave}
            className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50 touch-manipulation"
          >
            {isPending ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
