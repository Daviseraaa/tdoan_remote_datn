import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Package, History, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as adminApi from '@/src/api/admin';
import { queryKeys } from '@/src/lib/queryKeys';
import { apiErrorMessage } from '@/src/lib/api';
import type { SubscriptionPlan } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import AdminSubscriptionHistory from '@/src/views/admin/AdminSubscriptionHistory';
import { PlanPriceDisplay } from '@/src/components/admin/PlanPriceDisplay';

type PlansTab = 'plans' | 'history';

const emptyForm = {
  name: '',
  originalPriceVnd: 199000,
  priceVnd: 199000,
  durationDays: 30,
  maxAgents: 3,
  description: '',
  isActive: true,
};

export default function AdminPlans() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<PlansTab>('plans');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionPlan | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const { data: plans = [], isLoading } = useQuery({
    queryKey: queryKeys.adminPlans,
    queryFn: adminApi.listAdminPlans,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (form.originalPriceVnd < form.priceVnd) {
        throw new Error(t('adminPortal.priceOnSaleInvalid'));
      }
      if (modal === 'edit' && editPlan) {
        return adminApi.updateAdminPlan(editPlan.id, form);
      }
      return adminApi.createAdminPlan(form);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="text-primary" />
            {t('adminPortal.plansTitle')}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {tab === 'plans' ? t('adminPortal.plansSubtitle') : t('adminPortal.historySubtitle')}
          </p>
        </div>
        {tab === 'plans' ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm"
          >
            <Plus size={18} />
            {t('adminPortal.addPlan')}
          </button>
        ) : null}
      </div>

      <div className="flex gap-2 border-b border-white/10 pb-1">
        <button
          type="button"
          onClick={() => setTab('plans')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-bold transition-colors',
            tab === 'plans'
              ? 'bg-white/10 text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <Package size={16} />
          {t('adminPortal.tabPlans')}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-bold transition-colors',
            tab === 'history'
              ? 'bg-white/10 text-on-surface'
              : 'text-on-surface-variant hover:text-on-surface',
          )}
        >
          <History size={16} />
          {t('adminPortal.tabHistory')}
        </button>
      </div>

      {tab === 'history' ? <AdminSubscriptionHistory /> : null}

      {tab === 'plans' ? (
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="p-4">{t('common.name')}</th>
                <th className="p-4">{t('adminPortal.price')}</th>
                <th className="p-4">{t('adminPortal.duration')}</th>
                <th className="p-4">{t('adminPortal.maxAgents')}</th>
                <th className="p-4">{t('common.status')}</th>
                <th className="p-4 w-28" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : null}
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{p.name}</p>
                      {p.isTrial ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-secondary-container/40 text-secondary border border-white/10">
                          {t('adminPortal.trialPlan')}
                        </span>
                      ) : null}
                    </div>
                    {p.description ? (
                      <p className="prose-description text-xs text-on-surface-variant mt-0.5">{p.description}</p>
                    ) : null}
                    {p.isTrial ? (
                      <p className="text-[10px] text-on-surface-variant mt-1">{t('adminPortal.trialPlanHint')}</p>
                    ) : null}
                  </td>
                  <td className="p-4">
                    <PlanPriceDisplay plan={p} />
                  </td>
                  <td className="p-4">{p.durationDays} {t('adminPortal.days')}</td>
                  <td className="p-4">{p.maxAgents}</td>
                  <td className="p-4">
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
                        {p.isActive !== false ? t('adminPortal.planActive') : t('adminPortal.planInactive')}
                      </button>
                    )}
                  </td>
                  <td className="p-4">
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
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 space-y-4 border border-error/20">
            <h3 className="text-lg font-bold text-error">{t('common.delete')}</h3>
            <p className="text-sm text-on-surface-variant">
              {t('adminPortal.deletePlanConfirm', { name: deleteTarget.name })}
            </p>
            <p className="text-xs text-on-surface-variant opacity-80">
              {t('adminPortal.deletePlanHint')}
            </p>
            {deleteError ? <p className="text-error text-sm">{deleteError}</p> : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleteTarget.id)}
                className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-sm disabled:opacity-50"
              >
                {remove.isPending ? t('common.loading') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md rounded-2xl p-6 space-y-4 border border-white/10">
            <h3 className="text-lg font-bold">
              {modal === 'create' ? t('adminPortal.addPlan') : t('adminPortal.editPlan')}
            </h3>
            {error ? <p className="text-error text-sm">{error}</p> : null}
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              placeholder={t('common.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('adminPortal.originalPriceVnd')}
                </label>
                <input
                  type="number"
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm disabled:opacity-50"
                  value={form.originalPriceVnd}
                  disabled={editPlan?.isTrial === true}
                  onChange={(e) =>
                    setForm({ ...form, originalPriceVnd: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                  {t('adminPortal.salePriceVnd')}
                </label>
                <input
                  type="number"
                  className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm disabled:opacity-50"
                  value={form.priceVnd}
                  disabled={editPlan?.isTrial === true}
                  onChange={(e) => setForm({ ...form, priceVnd: Number(e.target.value) })}
                />
              </div>
            </div>
            {form.originalPriceVnd > form.priceVnd ? (
              <p className="text-xs text-error font-mono">
                {t('adminPortal.priceOnSale')}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                placeholder={t('adminPortal.durationDays')}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
              />
              <input
                type="number"
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                placeholder={t('adminPortal.maxAgents')}
                value={form.maxAgents}
                onChange={(e) => setForm({ ...form, maxAgents: Number(e.target.value) })}
              />
            </div>
            <textarea
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm min-h-[80px]"
              placeholder={t('adminPortal.description')}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className={cn('flex items-center gap-2 text-sm', editPlan?.isTrial && 'opacity-50')}>
              <input
                type="checkbox"
                checked={form.isActive}
                disabled={editPlan?.isTrial === true}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              {t('adminPortal.planActive')}
            </label>
            {editPlan?.isTrial ? (
              <p className="text-xs text-on-surface-variant">{t('adminPortal.trialPlanHint')}</p>
            ) : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={save.isPending || !form.name.trim()}
                onClick={() => save.mutate()}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
