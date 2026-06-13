import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Package, History, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as adminApi from '@/src/api/admin';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';
import { apiErrorMessage } from '@/src/lib/api';
import type { SubscriptionPlan } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import AdminSubscriptionHistory from '@/src/views/admin/AdminSubscriptionHistory';
import { PlanPriceDisplay } from '@/src/components/admin/PlanPriceDisplay';
import { PlanDurationCell } from '@/src/components/admin/PlanDurationCell';
import { PlanCard } from '@/src/components/admin/PlanCard';
import { PlanFormModal, type PlanFormState } from '@/src/components/admin/PlanFormModal';
import { formatMaxAgents } from '@/src/lib/planDisplay';
import {
  benefitsToText,
  normalizePlanBenefits,
  parseBenefitsText,
} from '@/src/lib/planBenefits';

type PlansTab = 'plans' | 'history';

const emptyForm: PlanFormState = {
  name: '',
  originalPriceVnd: 199000,
  priceVnd: 199000,
  durationDays: 30,
  maxAgents: 3,
  description: '',
  benefitsText: '',
  isActive: true,
};

function planFormPayload(form: PlanFormState) {
  return {
    name: form.name,
    originalPriceVnd: form.originalPriceVnd,
    priceVnd: form.priceVnd,
    durationDays: form.durationDays,
    maxAgents: form.maxAgents,
    description: form.description.trim() || undefined,
    benefits: parseBenefitsText(form.benefitsText),
    isActive: form.isActive,
  };
}

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
    <div className="space-y-0.5 max-w-[220px]">
      <p className="text-[10px] font-bold text-on-surface-variant">
        {t('adminPortal.benefitsLines', { n: String(lines.length) })}
      </p>
      <ul className="text-xs text-on-surface-variant/90 space-y-0.5">
        {lines.slice(0, 2).map((line) => (
          <li key={line} className="truncate" title={line}>
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

export default function AdminPlans() {
  const qc = useQueryClient();
  const adminEnabled = useAdminQueryEnabled();
  const [tab, setTab] = useState<PlansTab>('plans');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState<PlanFormState>(emptyForm);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: queryKeys.adminPlans,
    queryFn: adminApi.listAdminPlans,
    enabled: adminEnabled,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.originalPriceVnd < form.priceVnd) {
        throw new Error(t('adminPortal.priceOnSaleInvalid'));
      }
      if (modal === 'edit' && editPlan) {
        return adminApi.updateAdminPlan(editPlan.id, planFormPayload(form));
      }
      return adminApi.createAdminPlan(planFormPayload(form));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.adminPlans });
      setModal(null);
      setEditPlan(null);
      setForm(emptyForm);
      setError('');
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setEditPlan(null);
    setError('');
    setModal('create');
  };

  const openEdit = (p: SubscriptionPlan) => {
    setEditPlan(p);
    setForm({
      name: p.name,
      originalPriceVnd: p.originalPriceVnd ?? p.priceVnd,
      priceVnd: p.priceVnd,
      durationDays: p.durationDays,
      maxAgents: p.maxAgents,
      description: p.description ?? '',
      benefitsText: benefitsToText(normalizePlanBenefits(p.benefits)),
      isActive: p.isActive !== false,
    });
    setError('');
    setModal('edit');
  };

  const toggleActive = useMutation({
    mutationFn: (p: SubscriptionPlan) =>
      adminApi.updateAdminPlan(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminPlans }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteAdminPlan(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.adminPlans });
      setDeleteTarget(null);
      setDeleteError('');
    },
    onError: (err) => setDeleteError(apiErrorMessage(err)),
  });

  const openDelete = (p: SubscriptionPlan) => {
    setDeleteError('');
    setDeleteTarget(p);
  };

  const emptyState = (
    <p className="py-10 text-center text-sm text-on-surface-variant">{t('adminPortal.noPlans')}</p>
  );

  const loadingState = (
    <p className="py-10 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Package className="text-primary shrink-0" size={22} />
            <span className="truncate">{t('adminPortal.plansTitle')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            {tab === 'plans' ? t('adminPortal.plansSubtitle') : t('adminPortal.historySubtitle')}
          </p>
        </div>
        {tab === 'plans' ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm touch-manipulation"
          >
            <Plus size={18} />
            {t('adminPortal.addPlan')}
          </button>
        ) : null}
      </div>

      <div className="flex gap-1 sm:gap-2 border-b border-white/10 pb-1">
        <button
          type="button"
          onClick={() => setTab('plans')}
          className={cn(
            'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-t-xl text-xs sm:text-sm font-bold transition-colors touch-manipulation',
            tab === 'plans'
              ? 'bg-white/10 text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Package size={16} className="shrink-0" />
          <span className="truncate">{t('adminPortal.tabPlans')}</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={cn(
            'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-t-xl text-xs sm:text-sm font-bold transition-colors touch-manipulation',
            tab === 'history'
              ? 'bg-white/10 text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <History size={16} className="shrink-0" />
          <span className="truncate">{t('adminPortal.tabHistory')}</span>
        </button>
      </div>

      {tab === 'history' ? <AdminSubscriptionHistory /> : null}

      {tab === 'plans' ? (
        <>
          {/* Mobile: card list */}
          <div className="lg:hidden space-y-3">
            {isLoading ? loadingState : null}
            {!isLoading && plans.length === 0 ? emptyState : null}
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onEdit={() => openEdit(p)}
                onDelete={() => openDelete(p)}
                onToggleActive={() => toggleActive.mutate(p)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block glass-card rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                    <th className="p-4 min-w-[180px]">{t('common.name')}</th>
                    <th className="p-4">{t('adminPortal.price')}</th>
                    <th className="p-4">{t('adminPortal.duration')}</th>
                    <th className="p-4">{t('adminPortal.maxAgents')}</th>
                    <th className="p-4 min-w-[140px]">{t('adminPortal.benefitsColumn')}</th>
                    <th className="p-4">{t('common.status')}</th>
                    <th className="p-4 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                        {t('common.loading')}
                      </td>
                    </tr>
                  ) : null}
                  {!isLoading && plans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-on-surface-variant">
                        {t('adminPortal.noPlans')}
                      </td>
                    </tr>
                  ) : null}
                  {plans.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold">{p.name}</p>
                          {p.isTrial ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-secondary-container/40 text-secondary border border-white/10">
                              {t('adminPortal.trialPlan')}
                            </span>
                          ) : null}
                        </div>
                        {p.description ? (
                          <p className="text-xs text-on-surface-variant/80 mt-1 line-clamp-2">
                            {p.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="p-4 align-top">
                        <PlanPriceDisplay plan={p} />
                      </td>
                      <td className="p-4 align-top">
                        <PlanDurationCell days={p.durationDays} />
                      </td>
                      <td className="p-4 align-top font-mono font-bold">
                        {formatMaxAgents(p.maxAgents)}
                      </td>
                      <td className="p-4 align-top">
                        <PlanBenefitsPreview plan={p} />
                      </td>
                      <td className="p-4 align-top">
                        {p.isTrial ? (
                          <span className="px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-primary/15 text-primary">
                            {t('adminPortal.planActive')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleActive.mutate(p)}
                            className={cn(
                              'px-2 py-1 rounded-lg text-[10px] font-bold uppercase',
                              p.isActive !== false
                                ? 'bg-tertiary/20 text-tertiary'
                                : 'bg-white/10 text-on-surface-variant',
                            )}
                          >
                            {p.isActive !== false
                              ? t('adminPortal.planActive')
                              : t('adminPortal.planInactive')}
                          </button>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-2 rounded-lg hover:bg-white/5 text-primary"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Pencil size={16} />
                          </button>
                          {!p.isTrial ? (
                            <button
                              type="button"
                              onClick={() => openDelete(p)}
                              className="p-2 rounded-lg hover:bg-error/10 text-error"
                              title={t('common.delete')}
                              aria-label={t('common.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 space-y-4 border border-error/20 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-bold text-error">{t('common.delete')}</h3>
            <p className="text-sm text-on-surface-variant">
              {t('adminPortal.deletePlanConfirm', { name: deleteTarget.name })}
            </p>
            <p className="text-xs text-on-surface-variant opacity-80">
              {t('adminPortal.deletePlanHint')}
            </p>
            {deleteError ? <p className="text-error text-sm">{deleteError}</p> : null}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm touch-manipulation"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleteTarget.id)}
                className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-sm disabled:opacity-50 touch-manipulation"
              >
                {remove.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <PlanFormModal
          mode={modal}
          form={form}
          editPlan={editPlan}
          error={error}
          isPending={save.isPending}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onClose={() => setModal(null)}
          onSave={() => save.mutate()}
        />
      ) : null}
    </div>
  );
}
