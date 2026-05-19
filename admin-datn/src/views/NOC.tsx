import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  CheckCircle2, 
  Activity, 
  Database, 
  ShieldAlert, 
  Settings as SettingsIcon,
  Maximize2,
  Bell,
  Wifi,
  Clock,
  Map,
  Zap,
  Filter,
  ArrowUpRight,
  ChevronRight,
  X,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useQuery } from '@tanstack/react-query';
import * as adminApi from '@/src/api/admin';
import { useAuth } from '@/src/hooks/useAuth';
import { queryKeys } from '@/src/lib/queryKeys';
import { Link } from 'react-router-dom';

export default function NOC() {
  const [time, setTime] = useState(new Date().toUTCString());
  const [showAlert, setShowAlert] = useState(false);
  const { isAdmin } = useAuth();
  const { data: stats } = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: () => adminApi.getAdminStats(),
    enabled: isAdmin,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date().toUTCString()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-surface z-[100] flex flex-col overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 scanline pointer-events-none opacity-50" />
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-tertiary/5 blur-[120px] rounded-full" />

      {/* HUD Header */}
      <header className="h-24 px-10 flex justify-between items-center relative z-50 pointer-events-none">
        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-primary tracking-tighter uppercase italic leading-none">DATN CONSOLE</h1>
            <span className="text-[10px] font-mono text-primary/60 mt-1 font-bold tracking-[0.3em]">NETWORK OPERATIONS CENTER // v2.4.0-STABLE</span>
          </div>
          <div className="h-10 w-[1px] bg-white/10" />
          <div className="flex items-center gap-3 px-4 py-2 bg-error-container/20 border border-error/30 rounded-full animate-pulse cursor-pointer pointer-events-auto" onClick={() => setShowAlert(true)}>
             <div className="relative flex h-2 w-2">
               <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
               <div className="relative inline-flex rounded-full h-2 w-2 bg-error shadow-[0_0_8px_#ffb4ab]" />
             </div>
             <span className="font-mono text-[11px] font-bold text-error tracking-widest uppercase">
               {stats?.tasks.failed ?? 0} FAILED TASKS
             </span>
          </div>
        </div>

        <div className="flex items-center gap-6 pointer-events-auto">
           <Link to="/" className="flex items-center gap-3 px-6 py-2.5 glass-panel rounded-xl text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all font-mono text-[10px] font-bold tracking-[0.2em] uppercase">
             <Maximize2 size={16} />
             Exit Monitoring Mode
           </Link>
        </div>
      </header>

      {/* NOC Grid */}
      <main className="flex-1 grid grid-cols-12 grid-rows-6 gap-6 p-8 relative z-40">
        
        {/* Pulse Metrics */}
        <section className="col-span-12 row-span-1 grid grid-cols-4 gap-6">
          {[
            { label: 'System Uptime', value: '99.98', unit: '%', icon: Clock, color: 'text-primary' },
            {
              label: 'Tasks Completed',
              value: String(stats?.tasks.completed ?? '—'),
              unit: '',
              icon: CheckCircle2,
              color: 'text-tertiary',
            },
            {
              label: 'Active Agents',
              value: String(stats?.agents.online ?? '—'),
              unit: stats ? `/${stats.agents.total}` : '',
              icon: Bot,
              color: 'text-on-surface',
            },
            {
              label: 'Failed Tasks',
              value: String(stats?.tasks.failed ?? '—'),
              unit: '',
              icon: Zap,
              color: 'text-primary',
            },
          ].map((m) => (
            <div key={m.label} className="glass-panel p-6 rounded-2xl flex flex-col justify-between group hover:border-primary/30 transition-all">
               <div className="flex justify-between items-start opacity-40 group-hover:opacity-100 transition-all">
                 <span className="text-[10px] font-mono font-bold uppercase tracking-widest">{m.label}</span>
                 <m.icon size={16} className={m.color} />
               </div>
               <div className="flex items-baseline gap-2 mt-2">
                 <span className={cn("text-4xl font-bold tracking-tighter font-mono", m.color)}>{m.value}</span>
                 <span className={cn("text-xs font-mono font-bold opacity-40", m.color)}>{m.unit}</span>
               </div>
               <div className="w-full bg-white/5 h-[2px] rounded-full mt-4 overflow-hidden">
                 <div className={cn("h-full", m.color.replace('text-', 'bg-'))} style={{ width: `${Math.random()*40+60}%` }} />
               </div>
            </div>
          ))}
        </section>

        {/* Heatmap Area */}
        <section className="col-span-8 row-span-3 glass-panel rounded-2xl p-8 flex flex-col relative overflow-hidden">
           <div className="flex justify-between items-center mb-8">
             <div className="flex items-center gap-3">
               <Activity className="text-primary" size={20} />
               <h2 className="text-xl font-bold tracking-tight uppercase italic">Fleet Status Heatmap</h2>
             </div>
             <div className="flex items-center gap-6">
                {[
                  { l: 'ONLINE', c: 'bg-tertiary' },
                  { l: 'BUSY', c: 'bg-orange-400' },
                  { l: 'OFFLINE', c: 'bg-error' },
                  { l: 'IDLE', c: 'bg-white/10' },
                ].map((s) => (
                  <div key={s.l} className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-sm", s.c)} />
                    <span className="text-[9px] font-mono font-bold text-on-surface-variant tracking-wider uppercase">{s.l}</span>
                  </div>
                ))}
                <div className="w-[1px] h-6 bg-white/10 mx-2" />
                <button className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-lg text-[9px] font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-all">
                  All Clusters <ChevronRight size={12} className="rotate-90" />
                </button>
             </div>
           </div>

           <div className="flex-1 grid grid-cols-20 grid-rows-10 gap-2.5 overflow-hidden p-1">
             {Array.from({ length: 200 }).map((_, i) => {
               const states = ['bg-tertiary/20', 'bg-tertiary/40', 'bg-orange-400/20', 'bg-white/5'];
               const state = states[Math.floor(Math.random() * states.length)];
               const isSpecial = Math.random() > 0.97;
               return (
                 <div 
                  key={i} 
                  className={cn(
                    "aspect-square rounded-sm border transition-all duration-500", 
                    state,
                    state.includes('tertiary') ? 'border-tertiary/30' : 'border-white/5',
                    isSpecial && "bg-error animate-pulse border-error/50 shadow-[0_0_8px_#ffb4ab]"
                  )}
                 />
               );
             })}
           </div>
        </section>

        {/* Live Stream */}
        <section className="col-span-4 row-span-5 glass-panel rounded-2xl flex flex-col overflow-hidden">
           <div className="p-6 border-b border-white/5 flex items-center gap-3 bg-white/2">
             <Terminal className="text-primary" size={20} />
             <h2 className="text-xl font-bold tracking-tight uppercase italic">System Live Stream</h2>
             <div className="ml-auto flex items-center gap-2 px-2.5 py-1 bg-tertiary/10 rounded-full border border-tertiary/20">
               <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
               <span className="text-[9px] font-mono font-bold text-tertiary uppercase tracking-tighter">STREAMING</span>
             </div>
           </div>
           
           <div className="flex-1 bg-black/40 p-6 font-mono text-[11px] overflow-y-auto space-y-3 custom-scrollbar">
             {[
               { time: '14:28:01', type: 'INFO', msg: "Agent ALPHA-09 completed workflow 'Data Extraction'.", color: 'text-tertiary' },
               { time: '14:28:03', type: 'DEPLOY', msg: "Scale group 'EU-WEST-1' scaled to 48 nodes.", color: 'text-primary' },
               { time: '14:28:05', type: 'ERROR', msg: "Auth failure on node-vpx-21. Retrying in 500ms...", color: 'text-error' },
               { time: '14:28:09', type: 'INFO', msg: "Heartbeat received from 1,248 active agents.", color: 'text-tertiary' },
               { time: '14:28:12', type: 'DEBUG', msg: "Cache invalidated for workspace 'main_01'.", color: 'text-on-surface-variant opacity-40' },
               { time: '14:28:15', type: 'INFO', msg: "Inbound task 'Sentiment Analysis' queued.", color: 'text-tertiary' },
               { time: '14:28:22', type: 'FATAL', msg: "Cluster 09: Connection to DB-Primary failed.", color: 'bg-error/20 text-error px-1' },
               { time: '14:28:25', type: 'INFO', msg: "Workflow WF_392 executed in 1.4s.", color: 'text-tertiary' },
             ].map((log, i) => (
                <div key={i} className="flex gap-4 group">
                  <span className="text-on-surface-variant opacity-30 group-hover:opacity-100 transition-all font-bold shrink-0">{log.time}</span>
                  <div className="flex-1 truncate">
                    <span className={cn("font-bold tracking-widest mr-3", !log.color.includes('bg') && log.color.replace('opacity-40', ''))}>{log.type}</span>
                    <span className={cn("opacity-70", log.color.includes('bg') && log.color)}>{log.msg}</span>
                  </div>
                </div>
             ))}
           </div>

           <div className="p-3 border-t border-white/5 flex gap-2 overflow-x-hidden opacity-50 hover:opacity-100 transition-all">
             {['#ALL_LOGS', '#CLUSTER_01', '#SECURITY', '#WF_ENGINE'].map(tag => (
               <span key={tag} className={cn(
                 "px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold tracking-tight uppercase",
                 tag === '#CLUSTER_01' ? "bg-primary/20 text-primary" : "bg-white/5 text-on-surface-variant"
               )}>{tag}</span>
             ))}
           </div>
        </section>

        {/* Infra Stats */}
        <section className="col-span-4 row-span-2 glass-panel rounded-2xl p-8 flex gap-8">
           <div className="flex-1 flex flex-col justify-between">
              <div className="flex items-center gap-3">
                <Database className="text-primary" size={20} />
                <h3 className="text-lg font-bold tracking-tighter uppercase italic leading-none">Infrastructure</h3>
              </div>
              <div className="space-y-4">
                 <div className="bg-white/2 rounded-xl p-3 border border-white/5">
                   <p className="text-[9px] font-mono font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-1.5">LATENCY (P99)</p>
                   <p className="text-xl font-mono font-black text-primary tracking-tighter">24ms</p>
                 </div>
                 <div className="bg-white/2 rounded-xl p-3 border border-white/5">
                   <p className="text-[9px] font-mono font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mb-1.5">NETWORK IN/OUT</p>
                   <p className="text-xl font-mono font-black text-tertiary tracking-tighter">4.2GB/s</p>
                 </div>
              </div>
           </div>
           
           <div className="flex flex-col items-center justify-center gap-6 shrink-0">
              {/* Radial Gauges (SIMULATED) */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full rotate-[-90deg]">
                  <circle className="text-white/5" cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" />
                  <circle className="text-primary drop-shadow-[0_0_10px_#a4e6ff]" cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="301.59" strokeDashoffset="90" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-xl font-black font-mono tracking-tighter">70%</span>
                   <span className="text-[8px] font-mono font-bold uppercase opacity-40">CPU</span>
                </div>
              </div>
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full rotate-[-90deg]">
                  <circle className="text-white/5" cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" />
                  <circle className="text-tertiary drop-shadow-[0_0_10px_#68f5b8]" cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="301.59" strokeDashoffset="180" />
                </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <span className="text-xl font-black font-mono tracking-tighter">40%</span>
                   <span className="text-[8px] font-mono font-bold uppercase opacity-40">RAM</span>
                </div>
              </div>
           </div>
        </section>

        {/* Critical Panel Summary */}
        <section className="col-span-4 row-span-2 glass-panel rounded-2xl p-8 border-l-[3px] border-l-error bg-error-container/5">
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <ShieldAlert className="text-error" size={24} />
               <h3 className="text-2xl font-bold tracking-tighter uppercase italic text-error leading-none">Critical Alerts</h3>
             </div>
             <span className="text-[10px] font-mono font-bold text-error uppercase tracking-[0.2em] border border-error/30 px-2 py-0.5 rounded-full animate-pulse">ACTIVE</span>
           </div>
           
           <div className="space-y-4">
              {[
                { title: 'Database Primary Conn Failure', meta: 'Cluster-09 • 14:28:22' },
                { title: 'High Latency Spike (EU-WEST-2)', meta: 'Network Gateways • 14:24:15' },
              ].map((alert, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/2 border border-white/5 hover:bg-error-container/10 transition-all cursor-pointer group">
                  <div className="w-1.5 h-1.5 rounded-full bg-error mt-1.5 group-hover:scale-150 transition-all shadow-[0_0_8px_#ffb4ab]" />
                  <div>
                    <p className="text-sm font-bold tracking-tight text-on-surface">{alert.title}</p>
                    <p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-widest mt-1 opacity-60 group-hover:opacity-100">{alert.meta}</p>
                  </div>
                </div>
              ))}
           </div>
           
           <button className="w-full mt-6 py-4 bg-error text-on-error font-bold font-mono text-xs uppercase tracking-[0.3em] rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-error-container/30">
              Acknowledge All Criticals
           </button>
        </section>
      </main>

      {/* Ticker Footer */}
      <footer className="h-12 border-t border-white/5 bg-surface-container-low/80 backdrop-blur-md px-10 flex justify-between items-center relative z-50">
        <div className="flex items-center gap-8 text-[10px] font-mono font-bold tracking-widest">
           <div className="flex items-center gap-3">
             <span className="text-on-surface-variant opacity-40 uppercase">Secure Channel:</span>
             <span className="text-tertiary">ENCRYPTED_TLS_1.3</span>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-on-surface-variant opacity-40 uppercase">WS Status:</span>
             <span className="text-primary">CONNECTED_READY</span>
           </div>
           <div className="flex items-center gap-3">
             <span className="text-on-surface-variant opacity-40 uppercase">Region:</span>
             <span className="text-on-surface">LONDON_DC_01</span>
           </div>
        </div>
        <div className="text-[10px] font-mono font-bold text-on-surface-variant opacity-60 uppercase tracking-widest">{time}</div>
      </footer>

      {/* Alert Component Slide-over */}
      <AnimatePresence>
        {showAlert && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed inset-y-0 right-0 w-[500px] glass-panel z-[110] shadow-[-50px_0_100px_rgba(0,0,0,0.8)] border-l border-white/20 flex flex-col"
          >
             <div className="p-8 border-b border-white/10 flex justify-between items-center bg-error-container/20">
                <div className="flex items-center gap-3 text-error">
                  <ShieldAlert size={28} />
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase">Alert Detail</h3>
                </div>
                <button onClick={() => setShowAlert(false)} className="p-2 hover:bg-white/10 rounded-full transition-all text-on-surface-variant hover:text-on-surface">
                  <X size={24} />
                </button>
             </div>
             <div className="flex-1 p-10 overflow-y-auto custom-scrollbar space-y-10">
                <div>
                  <span className="text-xs font-mono font-bold text-error uppercase tracking-[0.3em] mb-2 block">SEVERITY: CRITICAL_FAILURE</span>
                  <h4 className="text-4xl font-bold tracking-tight text-white leading-tight">Database Primary Connection Failure</h4>
                  <p className="text-on-surface-variant mt-4 leading-relaxed font-medium">Cluster-09 heartbeat sync timeout detected. Secondary failover in progress but handshake rejected from EU-WEST-2 node pool.</p>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em] px-1">Error Trace</h5>
                  <div className="bg-black/60 p-6 rounded-2xl border border-white/10 font-mono text-xs text-error/80 leading-relaxed shadow-inner">
                    ConnectionTimeoutError: Failed to connect to db-primary.cluster-09 after 30000ms<br/>
                    at Socket.connect (node:net:123:14)<br/>
                    at TCPConnectWrap.afterConnect (node:net:113:16)<br/>
                    at Server.heartbeatCheck (bridge:core:88) [REDACTED]
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h5 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em] mb-2">Internal Node ID</h5>
                    <p className="text-lg font-bold font-mono text-on-surface">DB-PR-01_CL-09</p>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em] mb-2">Affected Region</h5>
                    <p className="text-lg font-bold text-on-surface uppercase tracking-tight">EU-SOUTH-A (MILANO)</p>
                  </div>
                </div>
             </div>
             <div className="p-8 bg-black/40 border-t border-white/10 flex flex-col gap-4">
                <button onClick={() => setShowAlert(false)} className="w-full py-5 bg-error text-on-error font-black italic tracking-widest text-sm uppercase rounded-2xl hover:brightness-110 active:scale-[0.98] transition-all">
                  Acknowledge Component Failure
                </button>
                <button className="w-full py-5 glass-panel border border-white/10 text-on-surface-variant hover:text-white font-bold tracking-widest text-xs uppercase rounded-2xl transition-all">
                  Escalate to On-Call Response Team
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
