import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Share2, 
  Zap,
  ListTodo,
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
  Headphones
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', adminOnly: false },
    { icon: Users, label: 'Agents', path: '/agents', adminOnly: false },
    { icon: ListTodo, label: 'Tasks', path: '/tasks', adminOnly: false },
    { icon: Share2, label: 'Workflows', path: '/workflows', adminOnly: false },
    { icon: Zap, label: 'Automations', path: '/automations', adminOnly: false },
    { icon: History, label: 'Audit Log', path: '/audit-log', adminOnly: true },
    { icon: Settings, label: 'Settings', path: '/settings', adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-4 top-4 bottom-4 w-[280px] rounded-2xl glass-panel shadow-2xl flex flex-col gap-y-4 p-4 z-50 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center shadow-lg shadow-primary-container/20">
          <Terminal className="text-on-primary-container" size={24} />
        </div>
        <div>
          <h1 className="font-bold tracking-tight text-primary leading-tight">DATN Console</h1>
          <p className="font-mono text-[10px] text-on-surface-variant opacity-60">v2.4.0-stable</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 mt-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
                          (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
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

      {/* Footer Actions */}
      <div className="mt-auto border-t border-white/5 pt-4 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => navigate('/agents')}
          className="w-full py-3 mb-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/20"
        >
          <PlusCircle size={18} />
          <span>Deploy Agent</span>
        </button>
        
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-mono">
          <Headphones size={16} />
          <span>SUPPORT</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-mono">
          <BookOpen size={16} />
          <span>DOCUMENTATION</span>
        </a>
      </div>
    </aside>
  );
}

export function TopBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const searchResults = [
    { category: 'Agents', items: [
      { id: '8821-X99', title: 'PROD-DATN-01', sub: 'Status: Online', path: '/agents' },
      { id: '4432-Y02', title: 'LINUX-NODE-B', sub: 'Status: Busy', path: '/agents' },
    ]},
    { category: 'Tasks', items: [
      { id: 't-1', title: 'Task queue', sub: 'View and dispatch tasks', path: '/tasks' },
    ]},
    { category: 'Workflows', items: [
      { id: 'wf-1', title: 'Process Analytics', sub: 'Path: Workflow Engine', path: '/workflows' },
      { id: 'wf-2', title: 'Database Sync', sub: 'Path: Backup Service', path: '/workflows' },
    ]},
    { category: 'Quick Navigation', items: [
      { id: 'p-1', title: 'System Settings', sub: 'Configure infrastructure', path: '/settings' },
      { id: 'p-2', title: 'Audit Logs', sub: 'View historical events', path: '/audit-log' },
    ]}
  ];

  const filteredResults = searchResults.map(cat => ({
    ...cat,
    items: cat.items.filter(item => 
      item.title.toLowerCase().includes(query.toLowerCase()) || 
      item.sub.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  // Keyboard shortcut
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
      <header className="fixed top-0 right-0 left-[300px] h-20 bg-surface/20 backdrop-blur-md border-b border-white/5 z-40 flex justify-between items-center px-8">
        {/* Search Trigger */}
        <div className="flex items-center flex-1 max-w-xl">
          <button 
            onClick={() => setIsOpen(true)}
            className="relative w-full group flex items-center bg-surface-container-low/50 border border-white/5 rounded-full pl-12 pr-4 py-2.5 text-sm text-on-surface-variant hover:bg-white/10 transition-all text-left"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-hover:text-primary transition-colors" size={18} />
            Search systems, agents, or logs...
            <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono opacity-60">
              <span className="text-[8px]">⌘</span>K
            </div>
          </button>
        </div>

        {/* Right Stats & Profile */}
      <div className="flex items-center gap-6">
        {/* WebSocket Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-tertiary-container/10 border border-tertiary-container/20 rounded-full">
          <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(104,245,184,0.6)]"></div>
          <span className="font-mono text-[11px] text-tertiary font-bold tracking-tight">WS: ACTIVE</span>
        </div>

        <div className="flex items-center gap-2">
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

        <div className="h-8 w-[1px] bg-white/10 mx-2"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden xl:block">
            <p className="text-sm font-semibold text-on-surface leading-none">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-on-surface-variant font-mono mt-1">{user?.role ?? '—'}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout().then(() => navigate('/login'))}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full text-on-surface-variant hover:text-error transition-all"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
          <div className="w-10 h-10 rounded-full border-2 border-primary/20 p-0.5 overflow-hidden ring-2 ring-transparent hover:ring-primary/20 transition-all cursor-pointer">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name ?? 'User'}`}
              alt={user?.name ?? 'User'}
              className="w-full h-full rounded-full object-cover bg-surface-container-high"
            />
          </div>
        </div>
      </div>
    </header>

      {/* Global Search Modal */}
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
                  placeholder="Type to search..."
                  className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-on-surface-variant/30"
                />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-on-surface-variant"
                >
                  ESC
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
                                {category.category === 'Agents' ? <Users size={18} /> : 
                                 category.category === 'Workflows' ? <Share2 size={18} /> : <ExternalLink size={18} />}
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
                    <p className="text-sm font-medium">No results found for "{query}"</p>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-on-surface-variant/60">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-on-surface">↑↓</span> to navigate</span>
                  <span className="flex items-center gap-1.5"><span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-on-surface">↵</span> to select</span>
                </div>
                <div>
                  Search data is decentralized and encrypted.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
