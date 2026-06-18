import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Calendar,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  Check,
  Clock,
  Bot,
  Zap,
  Receipt,
  X,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { normalizePlanBenefits } from '@/src/lib/planBenefits';
import { useAuth } from '@/src/hooks/useAuth';
import { useSubscription } from '@/src/hooks/useSubscription';
import * as billingApi from '@/src/api/billing';
import type { CheckoutResponse, PaymentRecord, SubscriptionPlan } from '@/src/types/api';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import { CopyButton } from '@/src/components/CopyButton';
import { PlanPriceDisplay } from '@/src/components/admin/PlanPriceDisplay';
import { PlanTierChip } from '@/src/components/billing/PlanTierChip';
import { formatVnd } from '@/src/lib/planPricing';
import {
  buildPlanTierMap,
  getPlanTierStyle,
  resolvePlanTierForPlan,
  type PlanTierId,
} from '@/src/lib/planTier';

function formatPlanPrice(plan: SubscriptionPlan): string {
  if (plan.isTrial || plan.priceVnd <= 0) return t('billing.freePrice');
  return formatVnd(plan.priceVnd);
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'TRIAL':
      return t('billing.statusTrial');
    case 'ACTIVE':
      return t('billing.statusActive');
    case 'EXPIRED':
      return t('billing.statusExpired');
    default:
      return status ?? '—';
  }
}

function paymentStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return t('billing.paymentStatusPending');
    case 'PAID':
      return t('billing.paymentStatusPaid');
    case 'EXPIRED':
      return t('billing.paymentStatusExpired');
    case 'FAILED':
      return t('billing.paymentStatusFailed');
    case 'CANCELLED':
      return t('billing.paymentStatusCancelled');
    default:
      return status;
  }
}

function paymentStatusStyle(status: string): string {
  switch (status) {
    case 'PAID':
      return 'bg-tertiary/15 text-tertiary border-tertiary/30';
    case 'PENDING':
      return 'bg-primary/15 text-primary border-primary/30';
    case 'EXPIRED':
    case 'FAILED':
      return 'bg-error/15 text-error border-error/30';
    default:
      return 'bg-white/5 text-on-surface-variant border-white/10';
  }
}

function subscriptionProgress(daysLeft: number, plan?: SubscriptionPlan | null): number {
  const total = plan?.durationDays ?? 30;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (daysLeft / total) * 100));
}

/** Chỉ bỏ segment trùng hẳn dòng ngày/agent chuẩn — không lọc mô tả marketing có nhắc ngày/agent */
function isDurationDuplicate(text: string, days: number): boolean {
  const n = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return (
    n === `${days} ngày` ||
    n === `${days} ngày sử dụng` ||
    n === `${days} day` ||
    n === `${days} days` ||
    n === `sử dụng ${days} ngày`
  );
}

function isAgentDuplicate(text: string, maxAgents: number): boolean {
  const n = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const nAgents = String(maxAgents);
  return (
    (n.includes('tối đa') || n.includes('maximum')) &&
    n.includes('agent') &&
    n.includes(nAgents) &&
    n.length <= 48
  );
}

/** Quyền lợi: admin chỉnh (benefits) → legacy mô tả → mặc định theo gói */
function buildPlanFeatures(plan: SubscriptionPlan): string[] {
  const custom = normalizePlanBenefits(plan.benefits);
  if (custom.length > 0) return custom;

  const marketing: string[] = [];
  const desc = plan.description?.trim();

  if (desc) {
    const segments = desc
      .split(/\r?\n|(?:\s*[,;•·]\s*)|(?:\s+—\s+)/)
      .map((s) => s.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
    for (const seg of segments.length > 0 ? segments : [desc]) {
      if (isDurationDuplicate(seg, plan.durationDays)) continue;
      if (isAgentDuplicate(seg, plan.maxAgents)) continue;
      marketing.push(seg);
    }
  }

  return [
    ...marketing,
    t('billing.featureDuration', { days: plan.durationDays }),
    t('billing.featureAgents', { n: plan.maxAgents }),
    t('billing.featureAuto'),
  ];
}

function DaysRing({
  percent,
  daysLeft,
  active,
  ringColor,
}: {
  percent: number;
  daysLeft: number;
  active: boolean;
  ringColor: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  const gradId = `billingRing-${ringColor.replace('#', '')}`;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={active ? `url(#${gradId})` : '#ffb4ab'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ringColor} />
            <stop offset="100%" stopColor={active ? '#a4e6ff' : '#ffb4ab'} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight">{daysLeft}</span>
        <span className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">
          {t('billing.daysLeft')}
        </span>
      </div>
    </div>
  );
}

function SubscriptionHero({
  plan,
  tier,
  status,
  isActive,
  isAdmin,
  daysLeft,
  expiresAt,
}: {
  plan: SubscriptionPlan | null;
  tier: PlanTierId;
  status?: string;
  isActive: boolean;
  isAdmin: boolean;
  daysLeft: number;
  expiresAt?: string | null;
}) {
  const style = getPlanTierStyle(tier);
  const TierIcon = style.Icon;
  const progress = isAdmin ? 100 : subscriptionProgress(daysLeft, plan);
  const onTrial = !isAdmin && (status === 'TRIAL' || plan?.isTrial === true);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border',
        style.card,
        style.border,
        style.shimmer && 'plan-tier-shine',
        style.diamondGlow && 'plan-tier-diamond-glow',
      )}
    >
      <div
        className={cn(
          'absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full pointer-events-none',
          style.orb,
        )}
      />
      <div
        className={cn(
          'absolute -bottom-20 -left-16 w-48 h-48 blur-[80px] rounded-full pointer-events-none',
          style.orbSecondary,
        )}
      />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">
          {!isAdmin ? (
            <DaysRing
              percent={progress}
              daysLeft={daysLeft}
              active={isActive}
              ringColor={style.ringActive}
            />
          ) : null}

          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <PlanTierChip tier={tier} showTierLabel />
              <span
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-bold border',
                  isActive || isAdmin
                    ? cn(style.tierBadge, style.tierBadgeText)
                    : 'bg-error/15 text-error border-error/30',
                )}
              >
                {isAdmin ? t('billing.statusActive') : statusLabel(status)}
              </span>
            </div>

            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-on-surface-variant/80 mb-1">
                {t('billing.currentPlan')}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <TierIcon size={28} className={cn('shrink-0', style.tierBadgeText)} />
                <h2
                  className={cn(
                    'text-2xl sm:text-3xl font-bold tracking-tight',
                    style.title,
                  )}
                >
                  {plan?.name ?? t('billing.noPlan')}
                </h2>
              </div>
              {plan && !isAdmin ? (
                <p className={cn('mt-2 text-sm font-medium', style.price)}>
                  {formatPlanPrice(plan)} · {t('billing.durationDays', { days: plan.durationDays })} ·{' '}
                  {t('billing.maxAgents', { n: plan.maxAgents })}
                </p>
              ) : null}
              {onTrial ? (
                <p className="mt-3 prose-description text-sm text-on-surface-variant/90">
                  {t('billing.trialPlanHint')}
                </p>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
              <div
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-2xl border',
                  style.tierBadge,
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    style.checkBg,
                  )}
                >
                  <Calendar size={16} className={style.checkIcon} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">
                    {t('billing.expiresAt')}
                  </p>
                  <p className="font-bold text-sm truncate">{isAdmin ? '—' : formatDate(expiresAt)}</p>
                </div>
              </div>
              <div
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-2xl border',
                  style.tierBadge,
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                    style.checkBg,
                  )}
                >
                  <ShieldCheck size={16} className={style.checkIcon} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">
                    {t('billing.daysProgress')}
                  </p>
                  <p className={cn('font-bold text-sm', style.tierBadgeText)}>
                    {isAdmin ? '∞' : `${Math.round(progress)}%`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-on-surface-variant">{label}</p>
      <div
        className={cn(
          'flex items-center gap-2 p-3 rounded-xl border transition-colors',
          highlight
            ? 'bg-primary/10 border-primary/25'
            : 'bg-surface-container-low/80 border-white/8',
        )}
      >
        <code className="flex-1 text-sm font-mono break-all text-on-surface">{value}</code>
        <CopyButton
          text={value}
          iconOnly
          iconSize={16}
          title={t('billing.copy')}
          className="shrink-0 p-2 rounded-lg hover:bg-white/8 text-primary"
        />
      </div>
    </div>
  );
}

function PlanPricingCard({
  plan,
  tier,
  isCurrent,
  loading,
  onCheckout,
}: {
  plan: SubscriptionPlan;
  tier: PlanTierId;
  isCurrent: boolean;
  loading: boolean;
  onCheckout: () => void;
}) {
  const features = buildPlanFeatures(plan);
  const style = getPlanTierStyle(tier);
  const TierIcon = style.Icon;

  return (
    <article
      className={cn(
        'group relative flex flex-col h-full overflow-hidden rounded-3xl border p-6 sm:p-7 transition-all duration-500',
        style.card,
        style.border,
        style.hoverLift,
        style.shimmer && 'plan-tier-shine',
        style.diamondGlow && 'plan-tier-diamond-glow',
        isCurrent && 'ring-2 ring-white/25 ring-offset-2 ring-offset-[#0b1326]',
      )}
    >
      <div
        className={cn(
          'absolute -top-16 -right-10 w-36 h-36 rounded-full blur-3xl pointer-events-none transition-opacity duration-500',
          style.orb,
          'opacity-50 group-hover:opacity-80',
        )}
      />
      <div
        className={cn(
          'absolute -bottom-20 -left-12 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-30',
          style.orbSecondary,
        )}
      />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

      <div className="relative z-[1] mb-5">
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-2 min-w-0 max-w-[calc(100%-5rem)] px-3 py-1.5 rounded-full text-sm font-bold tracking-tight border',
              style.tierBadge,
              style.tierBadgeText,
            )}
            title={t(style.labelKey)}
          >
            <TierIcon size={14} className="shrink-0" />
            <span className="truncate">{plan.name}</span>
          </span>
          {isCurrent ? (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-on-surface border border-white/20">
              {t('billing.currentPlanBadge')}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative z-[1] mb-6">
        <PlanPriceDisplay
          plan={plan}
          size="md"
          className="tracking-tight"
          priceClassName={style.price}
        />
        <p className="text-xs text-on-surface-variant/90 mt-1 font-mono">
          / {t('billing.durationDays', { days: plan.durationDays })}
        </p>
      </div>

      <div className="relative z-[1] space-y-2.5 mb-8 flex-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/80">
          {t('billing.planFeatures')}
        </p>
        <ul className="space-y-2">
          {features.map((f, i) => (
            <li key={`${plan.id}-feature-${i}`} className="flex items-start gap-2.5 text-sm text-on-surface-variant">
              <span
                className={cn(
                  'mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                  style.checkBg,
                )}
              >
                <Check size={11} className={style.checkIcon} />
              </span>
              <span className="prose-description text-sm">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={loading}
        className={cn(
          'relative z-[1] w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-300',
          style.button,
          'disabled:opacity-50 disabled:pointer-events-none',
        )}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <>
            <CreditCard size={18} />
            {t('billing.checkout')}
            <ArrowRight size={16} className="opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </button>
    </article>
  );
}

function TransferOverlay({
  checkout,
  onPaid,
  onClose,
}: {
  checkout: CheckoutResponse;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [pollMsg, setPollMsg] = useState(t('billing.waitingPayment'));
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const st = await billingApi.getPaymentStatus(checkout.paymentId);
        if (cancelled) return;
        if (st.status === 'PAID') {
          setPaid(true);
          setPollMsg(t('billing.paymentSuccess'));
          onPaid();
          return;
        }
        if (st.status === 'EXPIRED') {
          setPollMsg(t('billing.paymentExpired'));
          return;
        }
      } catch {
        /* ignore poll errors */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [checkout.paymentId, onPaid]);

  const steps = [
    { icon: Zap, label: t('billing.paymentStep1') },
    { icon: Building2, label: t('billing.paymentStep2') },
    { icon: ShieldCheck, label: t('billing.paymentStep3') },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex min-h-dvh min-w-full items-end sm:items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 min-h-dvh min-w-full bg-black/65 backdrop-blur-md"
        aria-label={t('billing.close')}
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[92dvh] overflow-y-auto custom-scrollbar rounded-t-3xl sm:rounded-3xl border border-primary/25 glass-panel shadow-2xl shadow-primary/10">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-4 border-b border-white/10 bg-surface-container/95 backdrop-blur-xl">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Building2 className="text-primary" size={20} />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h3 className="font-bold text-lg">{t('billing.transferTitle')}</h3>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                    paid
                      ? 'bg-tertiary/10 border-tertiary/30 text-tertiary'
                      : 'bg-primary/10 border-primary/25 text-primary',
                  )}
                >
                  {paid ? (
                    <Check size={13} className="shrink-0" />
                  ) : (
                    <Loader2 size={13} className="animate-spin shrink-0" />
                  )}
                  <span className="truncate max-w-[min(100%,14rem)] sm:max-w-none">{pollMsg}</span>
                </span>
              </div>
              <p className="text-xs text-on-surface-variant truncate">{checkout.planName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/8 text-on-surface-variant shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {steps.map(({ icon: Icon, label }, i) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <Icon size={14} className="text-primary" />
                {label}
              </span>
            ))}
          </div>

          <p className="text-sm text-on-surface-variant leading-relaxed">{t('billing.transferHint')}</p>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-90" />
                <img
                  src={checkout.qrUrl}
                  alt={t('billing.qrScanHint')}
                  className="relative w-52 h-52 rounded-2xl bg-white p-3 object-contain shadow-xl"
                  loading="eager"
                />
              </div>
              <p className="text-xs text-on-surface-variant text-center mt-4 max-w-[220px]">
                {t('billing.qrScanHint')}
              </p>
              {checkout.expiresAt ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-mono text-on-surface-variant">
                  <Clock size={12} />
                  {t('billing.expiresCheckout')}: {formatDate(checkout.expiresAt)}
                </p>
              ) : null}
            </div>

            <div className="space-y-3">
              <CopyField label={t('billing.bankName')} value={checkout.bankName} />
              <CopyField label={t('billing.accountNumber')} value={checkout.accountNumber} />
              <CopyField label={t('billing.accountHolder')} value={checkout.accountHolder} />
              <CopyField label={t('billing.amount')} value={formatVnd(checkout.amountVnd)} />
              <CopyField
                label={t('billing.transferContent')}
                value={checkout.transferContent}
                highlight
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentHistoryList({
  payments,
  loading,
  openingPaymentId,
  onOpenPending,
}: {
  payments: PaymentRecord[];
  loading: boolean;
  openingPaymentId: string | null;
  onOpenPending: (paymentId: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-on-surface-variant">
        <Loader2 size={18} className="animate-spin text-primary" />
        {t('common.loading')}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Receipt size={24} className="text-on-surface-variant opacity-50" />
        </div>
        <p className="font-bold text-on-surface">{t('billing.emptyHistoryTitle')}</p>
        <p className="text-sm text-on-surface-variant mt-1 max-w-xs">{t('billing.emptyHistoryHint')}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {payments.map((p) => {
        const isPending = p.status === 'PENDING';
        const isOpening = openingPaymentId === p.id;

        const rowInner = (
          <>
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                {isOpening ? (
                  <Loader2 size={18} className="text-primary animate-spin" />
                ) : (
                  <Receipt size={18} className="text-primary opacity-80" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold truncate">{p.plan.name}</p>
                <p className="text-xs font-mono text-on-surface-variant mt-0.5 truncate">
                  {p.paymentCode ?? p.orderCode}
                </p>
                <p className="text-[11px] text-on-surface-variant opacity-70 mt-0.5">
                  {formatDate(p.createdAt)}
                </p>
                {isPending ? (
                  <p className="text-[11px] text-primary font-medium mt-1.5">
                    {isOpening ? t('billing.reopeningPayment') : t('billing.openPendingPayment')}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 pl-[52px] sm:pl-0 shrink-0">
              <p className="font-bold text-sm">{formatVnd(p.amountVnd)}</p>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                  paymentStatusStyle(p.status),
                )}
              >
                {paymentStatusLabel(p.status)}
              </span>
              {isPending ? (
                <ChevronRight size={16} className="text-primary sm:hidden" aria-hidden />
              ) : null}
            </div>
          </>
        );

        if (isPending) {
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={isOpening}
                onClick={() => onOpenPending(p.id)}
                className={cn(
                  'w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-1 rounded-xl transition-colors text-left touch-manipulation',
                  'hover:bg-primary/5 active:bg-primary/10 border border-transparent hover:border-primary/20',
                  isOpening && 'opacity-70 pointer-events-none',
                )}
              >
                {rowInner}
              </button>
            </li>
          );
        }

        return (
          <li
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-1 rounded-xl"
          >
            {rowInner}
          </li>
        );
      })}
    </ul>
  );
}

export default function Billing() {
  const { refreshUser } = useAuth();
  const { isAdmin, isActive, daysLeft, status, expiresAt, plan } = useSubscription();
  const queryClient = useQueryClient();
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [openingPaymentId, setOpeningPaymentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<CheckoutResponse | null>(null);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: billingApi.listPlans,
    staleTime: 30_000,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['billing', 'payments'],
    queryFn: () => billingApi.listPayments(10),
  });

  /** Gói trả phí user đang dùng (trial không nằm trong danh sách checkout) */
  const currentPaidPlanId =
    plan && !plan.isTrial && status === 'ACTIVE' ? plan.id : null;

  const planTierById = useMemo(() => buildPlanTierMap(plans), [plans]);
  const currentPlanTier = useMemo(
    () => resolvePlanTierForPlan(plan, plans),
    [plan, plans],
  );

  const handleCheckout = async (planId: string) => {
    setError('');
    setCheckoutPlanId(planId);
    try {
      const result = await billingApi.createCheckout(planId);
      setPendingCheckout(result);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCheckoutPlanId(null);
    }
  };

  const handleOpenPending = async (paymentId: string) => {
    setError('');
    setOpeningPaymentId(paymentId);
    try {
      const result = await billingApi.getPaymentCheckout(paymentId);
      setPendingCheckout(result);
    } catch (err) {
      setError(apiErrorMessage(err));
      await queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
    } finally {
      setOpeningPaymentId(null);
    }
  };

  const handlePaid = async () => {
    await refreshUser();
    await queryClient.invalidateQueries({ queryKey: ['billing'] });
  };

  useEffect(() => {
    if (pendingCheckout) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [pendingCheckout]);

  useEffect(() => {
    if (!isAdmin && status === 'TRIAL' && plan && !plan.isTrial) {
      void refreshUser();
    }
  }, [isAdmin, status, plan, refreshUser]);

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16 px-1">
      <header className="relative">
        <div className="absolute -top-8 right-0 w-40 h-40 bg-primary/8 blur-[80px] rounded-full pointer-events-none" />
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-primary mb-2">
          {t('billing.navLabel')}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-on-surface">
          {t('billing.title')}
        </h1>
        <p className="prose-description text-sm sm:text-base text-on-surface-variant mt-2">
          {t('billing.subtitle')}
        </p>
      </header>

      {error ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={18} className="shrink-0" />
          {error}
        </div>
      ) : null}

      {pendingCheckout
        ? createPortal(
            <TransferOverlay
              checkout={pendingCheckout}
              onPaid={() => void handlePaid()}
              onClose={() => {
                setPendingCheckout(null);
                void queryClient.invalidateQueries({ queryKey: ['billing', 'payments'] });
              }}
            />,
            document.body,
          )
        : null}

      <SubscriptionHero
        plan={plan}
        tier={currentPlanTier}
        status={status}
        isActive={isActive}
        isAdmin={isAdmin}
        daysLeft={daysLeft}
        expiresAt={expiresAt}
      />

      {!isAdmin ? (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
                <Bot size={22} className="text-primary" />
                {t('billing.choosePlan')}
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">{t('billing.availablePlansHint')}</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
              {plans.length} {t('billing.availablePlans').toLowerCase()}
            </span>
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-on-surface-variant">
              <Loader2 size={20} className="animate-spin text-primary" />
              {t('common.loading')}
            </div>
          ) : plans.length === 0 ? (
            <div className="glass-card rounded-3xl border border-white/10 p-10 text-center text-on-surface-variant">
              {t('billing.noPlansAvailable')}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-5 items-stretch',
                plans.length === 1 ? 'max-w-md' : 'sm:grid-cols-2 lg:grid-cols-3',
              )}
            >
              {plans.map((p) => (
                <PlanPricingCard
                  key={p.id}
                  plan={p}
                  tier={planTierById.get(p.id) ?? 'emerald'}
                  isCurrent={p.id === currentPaidPlanId}
                  loading={checkoutPlanId === p.id}
                  onCheckout={() => void handleCheckout(p.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!isAdmin ? (
        <section className="glass-card rounded-3xl border border-white/10 overflow-hidden">
          <div className="px-6 sm:px-8 py-5 border-b border-white/5 flex items-center gap-2">
            <Receipt size={18} className="text-primary" />
            <h3 className="font-bold text-lg">{t('billing.paymentHistory')}</h3>
          </div>
          <div className="px-6 sm:px-8 pb-2">
            <PaymentHistoryList
              payments={payments}
              loading={paymentsLoading}
              openingPaymentId={openingPaymentId}
              onOpenPending={(id) => void handleOpenPending(id)}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
