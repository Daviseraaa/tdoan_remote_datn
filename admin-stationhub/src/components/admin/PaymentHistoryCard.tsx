import React from 'react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

type PaymentRow = {
  id: string;
  amountVnd: number;
  status: string;
  paymentCode?: string;
  paidAt?: string | null;
  createdAt: string;
  user: { name: string; email: string };
  plan: { name: string; durationDays: number };
};

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

type Props = {
  payment: PaymentRow;
  statusLabel: string;
  statusClass: string;
};

export function PaymentHistoryCard({ payment, statusLabel, statusClass }: Props) {
  const when = new Date(payment.paidAt ?? payment.createdAt).toLocaleString('vi-VN');

  return (
    <article className="rounded-2xl border border-white/10 bg-surface-container-low/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{payment.plan.name}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {payment.plan.durationDays} {t('adminPortal.days')}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold uppercase',
            statusClass,
          )}
        >
          {statusLabel}
        </span>
      </div>

      <p className="text-lg font-mono font-bold">{formatVnd(payment.amountVnd)}</p>

      <div className="space-y-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
            {t('adminPortal.paymentUser')}
          </p>
          <p className="font-medium mt-0.5">{payment.user.name}</p>
          <p className="font-mono text-on-surface-variant break-all">{payment.user.email}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
              {t('adminPortal.paymentTime')}
            </p>
            <p className="font-mono mt-0.5">{when}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
              {t('adminPortal.paymentCode')}
            </p>
            <p className="font-mono mt-0.5 break-all">{payment.paymentCode ?? '—'}</p>
          </div>
        </div>
      </div>
    </article>
  );
}
