import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Cpu,
  GitBranch,
  History,
  Terminal,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/hooks/useAuth';
import { useNavLayout } from '@/src/hooks/useNavLayout';
import { t } from '@/src/i18n/t';

const ADMIN_NAV = [
  { icon: LayoutDashboard, labelKey: 'adminNav.dashboard', path: '/admin' },
  { icon: Users, labelKey: 'adminNav.users', path: '/admin/users' },
  { icon: Package, labelKey: 'adminNav.plans', path: '/admin/plans' },
  { icon: Cpu, labelKey: 'adminNav.agents', path: '/admin/agents' },
  { icon: GitBranch, labelKey: 'adminNav.flows', path: '/admin/flows' },
  { icon: History, labelKey: 'adminNav.audit', path: '/admin/audit' },
] as const;

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { navOpen, closeNav } = useNavLayout();

  return (
    <>
      <AnimatePresence>
        {navOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeNav}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            aria-hidden
          />
        ) : null}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed z-50 flex flex-col gap-y-4 overflow-hidden glass-panel shadow-2xl p-4 transition-transform duration-300',
          'lg:left-4 lg:top-4 lg:bottom-4 lg:w-[280px] lg:rounded-2xl lg:translate-x-0',
          'left-0 top-0 bottom-0 w-[min(100vw,280px)] rounded-none rounded-r-2xl',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
              <Terminal className="text-on-primary-container" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold tracking-tight text-primary truncate">{t('common.brand')}</h1>
              <p className="font-mono text-[10px] text-tertiary">{t('adminNav.badge')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeNav}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5"
            aria-label={t('nav.closeSidebar')}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 mt-2 overflow-y-auto custom-scrollbar">
          {ADMIN_NAV.map((item) => {
            const isActive =
              item.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeNav}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold shadow-lg shadow-primary-container/20'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5',
                )}
              >
                <item.icon size={20} />
                <span className="text-sm font-medium">{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4 space-y-2 shrink-0">
          <div className="px-3 py-2 rounded-xl bg-surface-container-low border border-white/5">
            <p className="text-sm font-bold truncate">{user?.name}</p>
            <p className="text-[10px] font-mono text-on-surface-variant truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => navigate('/login'))}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 text-on-surface-variant hover:text-error"
          >
            <LogOut size={16} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
    </>
  );
}

export function AdminTopBar() {
  const { toggleNav } = useNavLayout();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full shrink-0 bg-surface/95 backdrop-blur-md border-b border-white/5">
      <div className="h-[var(--app-topbar-height)] flex items-center justify-between gap-3 px-4 lg:px-8">
        <button
          type="button"
          onClick={toggleNav}
          className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full"
          aria-label={t('nav.openMenu')}
        >
          <Menu size={20} />
        </button>
        <p className="text-sm font-bold text-on-surface-variant hidden sm:block">
          {t('adminNav.consoleTitle')}
        </p>
        <div className="flex items-center gap-2 ml-auto">
          <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider">
            ADMIN
          </span>
          <span className="text-sm font-semibold hidden md:inline">{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
