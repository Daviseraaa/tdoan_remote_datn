import { useAuth } from '@/src/hooks/useAuth';

export function useSubscription() {
  const { user, isAdmin } = useAuth();
  const isActive = isAdmin || user?.isSubscriptionActive === true;

  return {
    user,
    isAdmin,
    isActive,
    status: user?.subscriptionStatus,
    expiresAt: user?.subscriptionExpiresAt,
    daysLeft: user?.daysLeft ?? 0,
    plan: user?.plan ?? null,
    isTrial: user?.subscriptionStatus === 'TRIAL',
    isExpired: !isActive && !isAdmin,
  };
}
