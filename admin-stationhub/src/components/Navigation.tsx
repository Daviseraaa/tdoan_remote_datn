import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Share2, 
  Zap,
  Bot,
  ListTodo,
  FileJson,
  MousePointer2,
  History, 
  Settings, 
  Terminal,
  Search,
  Bell,
  Wifi,
  HelpCircle,
  PlusCircle,
  ChevronRight,
  LogOut,
  ExternalLink,
  BookOpen,
  Headphones,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';
import { SubscriptionBanner } from '@/src/components/SubscriptionBanner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useNavLayout } from '@/src/hooks/useNavLayout';
import { t } from '@/src/i18n/t';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { navOpen, closeNav } = useNavLayout();
  
  const navItems = [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/', adminOnly: false },
    { icon: Users, label: t('nav.agents'), path: '/agents', adminOnly: false },
    { icon: ListTodo, label: t('nav.tasks'), path: '/tasks', adminOnly: false },
    { icon: FileJson, label: t('nav.chromeScripts'), path: '/chrome-scripts', adminOnly: false },
    { icon: MousePointer2, label: t('nav.desktopRecordings'), path: '/desktop-recordings', adminOnly: false },
    { icon: Share2, label: t('nav.workflows'), path: '/workflows', adminOnly: false },
    { icon: Zap, label: t('nav.automations'), path: '/automations', adminOnly: false },
    { icon: Bot, label: t('nav.bots'), path: '/bots', adminOnly: false },
    { icon: CreditCard, label: t('nav.billing'), path: '/billing', adminOnly: false },
    { icon: History, label: t('nav.auditLog'), path: '/audit-log', adminOnly: true },
    { icon: Settings, label: t('nav.settings'), path: '/settings', adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin);

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
          'fixed z-50 flex flex-col gap-y-4 overflow-hidden glass-panel shadow-2xl p-4 transition-transform duration-300 ease-out',
          'lg:left-4 lg:top-4 lg:bottom-4 lg:w-[280px] lg:rounded-2xl lg:translate-x-0',
          'left-0 top-0 bottom-0 w-[min(100vw,280px)] rounded-none rounded-r-2xl',
          navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg shadow-primary-container/20 shrink-0">
              <Terminal className="text-on-primary-container" size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold tracking-tight text-primary leading-tight truncate">{t('common.brand')}</h1>
              <p className="font-mono text-[10px] text-on-surface-variant opacity-60">{t('common.version')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeNav}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-on-surface shrink-0"
            aria-label={t('nav.closeSidebar')}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 mt-4 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeNav}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-primary-container text-on-primary-container font-semibold shadow-lg shadow-primary-container/20" 
                    : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                )}
              >
                <item.icon size={20} className={cn(isActive ? "text-on-primary-container" : "text-on-surface-variant group-hover:text-on-surface")} />
                <span className="text-sm font-medium">{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-nav-glow"
                    className="absolute inset-0 rounded-xl bg-primary/20 blur-md -z-10"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/5 pt-4 flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              closeNav();
              navigate('/agents');
            }}
            className="w-full py-3 mb-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
          >
            <PlusCircle size={18} />
            <span>{t('nav.deployAgent')}</span>
          </button>
          
          <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-mono">
            <Headphones size={16} />
            <span>{t('nav.support')}</span>
          </a>
          <Link
            to="/docs"
            onClick={closeNav}
            className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-mono"
          >
            <BookOpen size={16} />
            <span>{t('nav.documentation')}</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

export function TopBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { toggleNav } = useNavLayout();

  const searchResults = [
    { category: t('nav.searchCategoryAgents'), items: [
      { id: '8821-X99', title: 'PROD-StationHub-01', sub: t('nav.mockAgent1Sub'), path: '/agents' },
      { id: '4432-Y02', title: 'LINUX-NODE-B', sub: t('nav.mockAgent2Sub'), path: '/agents' },
    ]},
    { category: t('nav.searchCategoryTasks'), items: [
      { id: 't-1', title: 'Task queue', sub: t('nav.mockTaskSub'), path: '/tasks' },
    ]},
    { category: t('nav.searchCategoryWorkflows'), items: [
      { id: 'wf-1', title: 'Process Analytics', sub: t('nav.mockWf1Sub'), path: '/workflows' },
      { id: 'wf-2', title: 'Database Sync', sub: t('nav.mockWf2Sub'), path: '/workflows' },
    ]},
    { category: t('nav.searchCategoryQuick'), items: [
      { id: 'p-1', title: 'System Settings', sub: t('nav.mockSettingsSub'), path: '/settings' },
      { id: 'p-2', title: 'Audit Logs', sub: t('nav.mockAuditSub'), path: '/audit-log' },
    ]}
  ];

  const filteredResults = searchResults.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.sub.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full shrink-0 bg-surface/95 backdrop-blur-md border-b border-white/5">
        <div className="h-[var(--app-topbar-height)] flex justify-between items-center gap-3 px-4 lg:px-8">
        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xl">
          <button
            type="button"
            onClick={toggleNav}
            className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface shrink-0"
            aria-label={t('nav.openMenu')}
          >
            <Menu size={20} />
          </button>

          <button 
            onClick={() => setIsOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface shrink-0"
            aria-label={t('nav.searchPlaceholder')}
          >
            <Search size={18} />
          </button>

          <button 
            onClick={() => setIsOpen(true)}
            className="relative hidden lg:flex w-full group items-center bg-surface-container-low/50 border border-white/5 rounded-full pl-12 pr-4 py-2.5 text-sm text-on-surface-variant hover:bg-white/10 transition-all text-left"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-hover:text-primary transition-colors" size={18} />
            {t('nav.searchPlaceholder')}
            <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono opacity-60">
              <span className="text-[8px]">⌘</span>K
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-tertiary-container/10 border border-tertiary-container/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(104,245,184,0.6)]"></div>
            <span className="font-mono text-[11px] text-tertiary font-bold tracking-tight">{t('nav.wsActive')}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <button className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface">
              <Bell size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface">
              <Wifi size={18} />
            </button>
            <button className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface">
              <HelpCircle size={18} />
            </button>
          </div>

          <div className="hidden sm:block h-8 w-[1px] bg-white/10 mx-2"></div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right hidden xl:block">
              <p className="text-sm font-semibold text-on-surface leading-none">{user?.name ?? t('common.user')}</p>
              <p className="text-[10px] text-on-surface-variant font-mono mt-1">{user?.role ?? '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout().then(() => navigate('/login'))}
              className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-on-surface-variant hover:text-error transition-all"
              title={t('nav.logout')}
            >
              <LogOut size={18} />
            </button>
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden ring-2 ring-transparent hover:ring-primary/20 transition-all cursor-pointer">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name ?? t('common.user')}`}
                alt={user?.name ?? t('common.user')}
                className="w-full h-full rounded-full object-cover bg-surface-container-high"
              />
            </div>
          </div>
        </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl glass-card bg-surface rounded-2xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10"
            >
              <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/2">
                <Search className="text-primary" size={20} />
                <input 
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('nav.searchTypePlaceholder')}
                  className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-on-surface-variant/30"
                />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-on-surface-variant"
                >
                  {t('nav.esc')}
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                {filteredResults.length > 0 ? (
                  <div className="space-y-4 p-2">
                    {filteredResults.map((category) => (
                      <div key={category.category} className="space-y-1">
                        <h4 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-[0.2em] px-3 py-1">
                          {category.category}
                        </h4>
                        {category.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              navigate(item.path);
                              setIsOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-4 rounded-xl hover:bg-white/5 transition-all text-left group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors">
                                {category.category === t('nav.searchCategoryAgents') ? <Users size={18} /> : 
                                 category.category === t('nav.searchCategoryWorkflows') ? <Share2 size={18} /> : <ExternalLink size={18} />}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">{item.title}</p>
                                <p className="text-xs text-on-surface-variant/60">{item.sub}</p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0" />
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-on-surface-variant/40">
                    <History size={40} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">{t('nav.noResults', { query })}</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-on-surface-variant/60">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-on-surface">↑↓</span> {t('nav.navigateHint')}</span>
                  <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-on-surface">↵</span> {t('nav.selectHint')}</span>
                </div>
                <div>
                  {t('nav.searchEncrypted')}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
