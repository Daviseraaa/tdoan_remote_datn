import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useSubscription } from '@/src/hooks/useSubscription';
import { isAuthenticated } from '@/src/lib/auth';

function LoadingScreen() {
  return (
    <div className="min-h-dvh h-dvh bg-surface flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

const BILLING_PATHS = ['/billing'];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoading, isAdmin } = useAuth();
  const { isExpired } = useSubscription();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const onBillingPath = BILLING_PATHS.some((p) => location.pathname.startsWith(p));
  if (!isAdmin && isExpired && !onBillingPath) {
    return <Navigate to="/billing" replace />;
  }

  return <>{children}</>;
}
