import React from 'react';
import { NavLayoutProvider } from '@/src/context/NavLayoutContext';
import { AdminSidebar, AdminTopBar } from './AdminSidebar';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavLayoutProvider>
      <div className="flex min-h-dvh lg:h-dvh lg:overflow-hidden w-full bg-surface">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-[300px] lg:min-h-0 lg:h-full lg:overflow-hidden">
          <AdminTopBar />
          <main className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 lg:px-8 lg:pb-8 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="max-w-[1600px] mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </NavLayoutProvider>
  );
}
