import React, { useState, useMemo } from 'react';
import { 
  Download, 
  Search, 
  Calendar, 
  ChevronDown, 
  User, 
  Bot, 
  Cpu, 
  Fingerprint, 
  AlertTriangle, 
  CheckCircle2, 
  History,
  MoreHorizontal,
  Filter,
  X,
  Clock,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuditLogs } from '@/src/hooks/useAudit';
import { mapAuditToLogRow } from '@/src/lib/mappers';

const LOG_DATA_FALLBACK = [
  { 
    id: 1,
    time: '14:22:01', 
    date: '2023-10-27',
    status: 'CRITICAL', 
    title: 'Agent Permission Revoked', 
    actor: 'Admin_Sarah_K', 
    target: 'AGENT_772_DL',
    category: 'Security',
    payload: '{ "action": "revoke_access", "resource": "network_cluster_beta", "reason": "anomaly" }'
  },
  { 
    id: 2,
    time: '13:45:12', 
    date: '2023-10-27',
    status: 'WARNING', 
    title: 'High Memory Usage Alert', 
    actor: 'SYSTEM_MONITOR', 
    target: 'NODE_PX_4',
    category: 'System',
    detail: 'Node PX_4 has exceeded 85% memory threshold. Automated garbage collection initiated by system watcher. Monitoring for potential leak.'
  },
  { 
    id: 3,
    time: '12:10:05', 
    date: '2023-10-26',
    status: 'INFO', 
    title: 'User Login Successful', 
    actor: 'user_8229_dev', 
    target: 'CLOUD_CONSOLE',
    category: 'Auth',
    detail: 'OAuth Multi-Factor Authentication validated for region EU-WEST-1.'
  },
  { 
    id: 4,
    time: '11:58:30', 
    date: '2023-10-26',
    status: 'INFO', 
    title: 'Task Process Started', 
    actor: 'AutoScaler_v2', 
    target: 'BATCH_REINDEX_04',
    category: 'Automation',
    eta: '4m 12s'
  },
  {
    id: 5,
    time: '09:12:44',
    date: '2023-10-26',
    status: 'CRITICAL',
    title: 'Firewall Breach Attempt',
    actor: 'EXT_SHADOW_GATE',
    target: 'EDGE_ROUTER_01',
    category: 'Security',
    payload: '{ "source_ip": "192.168.1.100", "packets": 4500, "type": "syn_flood" }'
  },
  {
    id: 6,
    time: '08:30:15',
    date: '2023-10-25',
    status: 'INFO',
    title: 'Workflow Optimized',
    actor: 'AI_Optimizer',
    target: 'WF_DATA_INGEST_V3',
    category: 'System',
    detail: 'Path re-routing reduced latency by 12% across distributed nodes.'
  }
];

const LogEntry = ({ time, date, status, title, actor, target, payload, detail, eta }: any) => (
  <motion.div 
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex gap-10 group relative pb-10"
  >
    {/* Timeline Point */}
    <div className="relative z-10">
      <div className="w-20 font-mono text-[11px] text-on-surface-variant font-bold pt-2">{time}</div>
      <div className={cn(
        "absolute left-[84px] top-2.5 w-2 h-2 rounded-full border-2 border-surface z-10",
        status === 'CRITICAL' ? "bg-error shadow-[0_0_10px_#ffb4ab]" : 
        status === 'WARNING' ? "bg-tertiary shadow-[0_0_10px_#68f5b8]" : "bg-primary shadow-[0_0_10px_#a4e6ff]"
      )} />
    </div>

    {/* Content Card */}
    <div className="flex-1 glass-card p-6 rounded-2xl hover:bg-white/[0.07] transition-all cursor-default group-hover:border-white/20">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h4 className="font-bold text-on-surface">{title}</h4>
            <span className={cn(
              "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border",
              status === 'CRITICAL' ? "bg-error-container/20 text-error border-error/20" : 
              status === 'WARNING' ? "bg-tertiary-container/10 text-tertiary border-tertiary/20" : "bg-primary-container/10 text-primary border-primary/20"
            )}>{status}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant leading-none">
            <div className="flex items-center gap-1.5 hover:text-on-surface transition-colors cursor-pointer">
              <User size={12} />
              <span>{actor}</span>
            </div>
            <span className="opacity-20">|</span>
            <div className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer">
              <History size={12} />
              <span>Target: {target}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
           <span className="font-mono text-[9px] text-on-surface-variant opacity-40">TX_ID: 8829-AF-00{Math.floor(Math.random()*9)}</span>
           <button className="p-1 hover:bg-white/5 rounded transition-all text-on-surface-variant hover:text-on-surface">
             <MoreHorizontal size={16} />
           </button>
        </div>
      </div>

      {payload && (
        <div className="bg-surface-container-lowest/50 rounded-xl p-4 border border-white/5 font-mono text-[11px] text-on-surface-variant leading-relaxed mb-4">
           {payload}
        </div>
      )}

      {detail && (
        <p className="text-xs text-on-surface-variant leading-relaxed opacity-80">{detail}</p>
      )}

      {eta && (
        <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
             <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">Task Status: Running</span>
           </div>
           <span className="text-[10px] font-mono text-on-surface-variant opacity-60">ETA: {eta}</span>
        </div>
      )}
    </div>
  </motion.div>
);

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState('All Time');

  const { data: auditPage, isLoading } = useAuditLogs({
    page: 1,
    limit: 100,
    actor: search || undefined,
  });

  const logSource = useMemo(() => {
    const fromApi = (auditPage?.items ?? []).map(mapAuditToLogRow);
    return fromApi.length ? fromApi : LOG_DATA_FALLBACK;
  }, [auditPage]);

  const categories = ['All Categories', 'Security', 'System', 'Auth', 'Automation'];
  const severities = ['INFO', 'WARNING', 'CRITICAL'];

  const filteredLogs = useMemo(() => {
    return logSource.filter(log => {
      const matchesSearch = 
        log.title.toLowerCase().includes(search.toLowerCase()) || 
        log.actor.toLowerCase().includes(search.toLowerCase()) ||
        log.target.toLowerCase().includes(search.toLowerCase());
      
      const matchesSeverity = selectedSeverities.length === 0 || selectedSeverities.includes(log.status);
      const matchesCategory = selectedCategory === 'All Categories' || log.category === selectedCategory;
      
      // Simple date range mock logic
      let matchesDate = true;
      if (dateRange === 'Last 24h') matchesDate = log.date === '2023-10-27';
      if (dateRange === 'Last 7 Days') matchesDate = true; // All mock data is within 7 days

      return matchesSearch && matchesSeverity && matchesCategory && matchesDate;
    });
  }, [logSource, search, selectedSeverities, selectedCategory, dateRange]);

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities(prev => 
      prev.includes(sev) ? prev.filter(s => s !== sev) : [...prev, sev]
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedSeverities([]);
    setSelectedCategory('All Categories');
    setDateRange('All Time');
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">System Audit Log</h2>
          <p className="text-on-surface-variant text-body-md mt-2 max-w-2xl leading-relaxed">
            Real-time immutable ledger of all system interactions, agent deployments, and security escalations within the DATN infrastructure.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-on-surface hover:bg-white/10 transition-all uppercase tracking-widest active:scale-95">
          <Download size={14} className="text-primary" />
          Export Data
        </button>
      </div>

      {/* Advanced Filter UI */}
      <div className="glass-card rounded-3xl p-6 mb-12 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Fingerprint size={120} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Search */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">Search Events / Actors</label>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" size={18} />
              <input 
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find by event name, agent ID, or user..."
                className="w-full bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {/* Category Dropdown */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">Category</label>
            <div className="relative">
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 px-5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary/40 transition-all"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-surface">{cat}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={16} />
            </div>
          </div>

          {/* Date Range Dropdown */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">Time Horizon</label>
            <div className="relative">
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full appearance-none bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 px-5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary/40 transition-all"
              >
                {['All Time', 'Last 24h', 'Last 7 Days', 'Last 30 Days', 'Custom Range'].map(range => (
                  <option key={range} value={range} className="bg-surface">{range}</option>
                ))}
              </select>
              <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">Severity Level:</span>
            <div className="flex flex-wrap gap-2">
              {severities.map(sev => (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-2",
                    selectedSeverities.includes(sev)
                      ? sev === 'CRITICAL' ? "bg-error/20 border-error/40 text-error" :
                        sev === 'WARNING' ? "bg-tertiary/20 border-tertiary/40 text-tertiary" :
                        "bg-primary/20 border-primary/40 text-primary"
                      : "bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20"
                  )}
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    sev === 'CRITICAL' ? "bg-error" : sev === 'WARNING' ? "bg-tertiary" : "bg-primary",
                    !selectedSeverities.includes(sev) && "opacity-40"
                  )} />
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 justify-end flex-1">
             <button 
              onClick={clearFilters}
              className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant hover:text-on-surface transition-colors"
             >
               <X size={14} />
               RESET FILTERS
             </button>
             <div className="w-px h-4 bg-white/10" />
             <p className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.1em]">
               Matches Found: <span className="text-on-surface">{filteredLogs.length}</span>
             </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative min-h-[400px]">
        {filteredLogs.length > 0 ? (
          <>
            <div className="absolute left-[87.5px] top-4 bottom-0 w-[1px] bg-white/5" />
            <AnimatePresence mode="popLayout">
              {filteredLogs.map(log => (
                <LogEntry 
                  key={log.id}
                  time={log.time}
                  date={log.date}
                  status={log.status}
                  title={log.title}
                  actor={log.actor}
                  target={log.target}
                  category={log.category}
                  payload={log.payload}
                  detail={log.detail}
                  eta={log.eta}
                />
              ))}
            </AnimatePresence>
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 bg-white/2 rounded-3xl border border-dashed border-white/10"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant/30 mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No logs found</h3>
            <p className="text-on-surface-variant text-sm text-center max-w-xs">
              Try adjusting your filters or search terms to find what you're looking for.
            </p>
            <button 
              onClick={clearFilters}
              className="mt-6 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:scale-105 active:scale-95 transition-all text-xs"
            >
              Clear All Filters
            </button>
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-12 pt-8 border-t border-white/5 flex justify-between items-center text-on-surface-variant">
        <p className="text-xs font-medium">Showing 1-10 of 1,248 entries</p>
        <div className="flex gap-2 font-mono text-xs">
          <button className="px-4 py-2 rounded-lg bg-surface-container-high border border-white/5 hover:bg-white/10 transition-all font-bold opacity-30 cursor-not-allowed">PREV</button>
          {[1, 2, 3, '...', 125].map((p, i) => (
            <button 
              key={i} 
              className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg border border-white/5 transition-all font-bold",
                p === 1 ? "bg-primary text-on-primary border-primary/30 shadow-lg shadow-primary/20" : "hover:bg-white/5 text-on-surface-variant"
              )}
            >
              {p}
            </button>
          ))}
          <button className="px-4 py-2 rounded-lg bg-surface-container-high border border-white/10 hover:bg-white/10 transition-all font-bold text-on-surface">NEXT</button>
        </div>
      </div>
    </div>
  );
}
