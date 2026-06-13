import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as adminApi from '@/src/api/admin';
import { Pagination } from '@/src/components/Pagination';
import { PaymentHistoryCard } from '@/src/components/admin/PaymentHistoryCard';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';
import { t } from '@/src/i18n/t';

const PAGE = 25;

const STATUSES = ['', 'PENDING', 'PAID', 'EXPIRED', 'FAILED', 'CANCELLED'] as const;

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return t('adminPortal.paymentPending');
    case 'PAID':
      return t('adminPortal.paymentPaid');
    case 'FAILED':
      return t('adminPortal.paymentFailed');
    case 'CANCELLED':
      return t('adminPortal.paymentCancelled');
    case 'EXPIRED':
      return t('adminPortal.paymentExpired');
    default:
      return status;
  }
}

function paymentStatusClass(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-tertiary/20 text-tertiary';
    case 'PENDING':
      return 'bg-primary/20 text-primary';
    case 'EXPIRED':
    case 'FAILED':
      return 'bg-error/20 text-error';
    default:
      return 'bg-white/10 text-on-surface-variant';
  }
}

export default function AdminSubscriptionHistory() {
  const adminEnabled = useAdminQueryEnabled();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminPayments({ page, limit: PAGE, status: status || undefined }),
    queryFn: () =>
      adminApi.listAdminPayments({
        page,
        limit: PAGE,
        status: status || undefined,
      }),
    enabled: adminEnabled,
    refetchInterval: adminEnabled ? 30_000 : false,
  });

  const rows = data?.items ?? [];
  const meta = data?.meta;

  const emptyState = (
    <div className="py-10 text-center text-on-surface-variant">
      <History size={24} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">{t('adminPortal.noPayments')}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 custom-scrollbar">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={cn(
              'shrink-0 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold touch-manipulation',
              status === s ? 'bg-primary text-on-primary' : 'bg-white/5',
            )}
          >
            {s ? paymentStatusLabel(s) : t('common.all')}
          </button>
        ))}
      </div>

      {/* Mobile: cards */}
      <div className="lg:hidden space-y-3">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">{t('common.loading')}</p>
        ) : null}
        {!isLoading && rows.length === 0 ? emptyState : null}
        {rows.map((p) => (
          <PaymentHistoryCard
            key={p.id}
            payment={p}
            statusLabel={paymentStatusLabel(p.status)}
            statusClass={paymentStatusClass(p.status)}
          />
        ))}
        {meta ? (
          <Pagination page={page} limit={PAGE} total={meta.total} onPageChange={setPage} />
        ) : null}
      </div>

      {/* Desktop: table */}
      <div className="hidden lg:block glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="p-4">{t('adminPortal.paymentTime')}</th>
                <th className="p-4">{t('adminPortal.paymentUser')}</th>
                <th className="p-4">{t('adminPortal.paymentPlan')}</th>
                <th className="p-4">{t('adminPortal.paymentAmount')}</th>
                <th className="p-4">{t('adminPortal.paymentCode')}</th>
                <th className="p-4">{t('adminPortal.paymentStatus')}</th>
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
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    <History size={24} className="mx-auto mb-2 opacity-40" />
                    {t('adminPortal.noPayments')}
                  </td>
                </tr>
              ) : null}
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-xs font-mono whitespace-nowrap">
                    {new Date(p.paidAt ?? p.createdAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{p.user.name}</p>
                    <p className="text-xs font-mono text-on-surface-variant">{p.user.email}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-bold">{p.plan.name}</p>
                    <p className="text-xs text-on-surface-variant">
                      {p.plan.durationDays} {t('adminPortal.days')}
                    </p>
                  </td>
                  <td className="p-4 font-mono">{formatVnd(p.amountVnd)}</td>
                  <td className="p-4 font-mono text-xs">{p.paymentCode}</td>
                  <td className="p-4">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-lg text-[10px] font-bold uppercase',
                        paymentStatusClass(p.status),
                      )}
                    >
                      {paymentStatusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta ? (
          <div className="p-4 border-t border-white/5">
            <Pagination page={page} limit={PAGE} total={meta.total} onPageChange={setPage} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
