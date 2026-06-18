import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DocsHeader } from './DocsHeader';
import { DocsSidebar } from './DocsSidebar';

export function DocsLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen]);

  return (
    <div className="min-h-dvh w-full bg-[#fafaf9] text-gray-900 font-nimbus">
      <DocsHeader onOpenNav={() => setNavOpen(true)} />

      <div className="docs-grid">
        <aside className="docs-nav-col hidden lg:block" aria-label="Docs navigation">
          <DocsSidebar />
        </aside>

        <main className="docs-main-col min-w-0 w-full py-5 sm:py-8 lg:py-10">
          <Outlet />
        </main>
      </div>

      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Đóng menu"
            onClick={() => setNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(300px,88vw)] bg-white shadow-2xl flex flex-col">
            <DocsSidebar variant="drawer" onNavigate={() => setNavOpen(false)} onClose={() => setNavOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
