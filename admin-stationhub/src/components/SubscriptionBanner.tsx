import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Sparkles } from 'lucide-react';
import { useSubscription } from '@/src/hooks/useSubscription';
import { t } from '@/src/i18n/t';

export function SubscriptionBanner() {
  const { isAdmin, isExpired, isTrial, daysLeft } = useSubscription();

  if (isAdmin) return null;

  if (isExpired) {
    return (
      <div className="mx-4 lg:mx-8 mt-4 mb-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
        <AlertCircle size={18} className="shrink-0" />
        <span className="flex-1">{t('billing.expiredBanner')}</span>
        <Link
          to="/billing"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-error text-on-error text-xs font-bold hover:brightness-110"
        >
          {t('billing.renewNow')}
        </Link>
      </div>
    );
  }

  if (isTrial && daysLeft <= 7) {
    return (
      <div className="mx-4 lg:mx-8 mt-4 mb-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-container/20 border border-primary/20 text-on-surface text-sm">
        <Sparkles size={18} className="shrink-0 text-primary" />
        <span className="flex-1">{t('billing.trialBanner', { n: daysLeft })}</span>
        <Link
          to="/billing"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110"
        >
          {t('billing.viewPlans')}
        </Link>
      </div>
    );
  }

  return null;
}
