import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';

export function UserOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
