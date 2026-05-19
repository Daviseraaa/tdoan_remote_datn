import React from 'react';
import { 
  Zap, 
  MoreHorizontal, 
  Play, 
  Square, 
  History, 
  Clock, 
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  Activity,
  Plus
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { useWorkflowsList, useWorkflowMutations } from '@/src/hooks/useWorkflows';
import { mapWorkflowToAutomationRow } from '@/src/lib/mappers';

const AutomationRow = ({
  title,
  status,
  lastRun,
  schedule,
  successRate,
  activeNodes,
  onPlay,
}: {
  title: string;
  status: string;
  lastRun: string;
  schedule: string;
  successRate: number;
  activeNodes: string[];
  onPlay?: () => void;
}) => (
  <div className="group glass-card hover:bg-white/[0.04] transition-all rounded-2xl flex items-center gap-8 p-6 cursor-pointer border-transparent active:scale-[0.995]">
    <div className="w-14 h-14 rounded-2xl bg-surface-container-high border border-white/5 flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors group-hover:bg-primary/5">
      <Zap size={28} className={cn(status === 'Running' && "text-primary animate-pulse")} />
    </div>
    
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3 mb-1">
        <h3 className="text-xl font-bold tracking-tight text-on-surface truncate group-hover:text-primary transition-colors">{title}</h3>
        <span className={cn(
          "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
          status === 'Running' ? "bg-primary-container/10 text-primary border-primary/20" : "bg-white/5 text-on-surface-variant border-white/10"
        )}>
           {status}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[11px] font-mono text-on-surface-variant opacity-60">
        <div className="flex items-center gap-1.5"><Clock size={12} /> {schedule}</div>
        <div className="flex items-center gap-1.5"><History size={12} /> Last run: {lastRun}</div>
      </div>
    </div>

    <div className="hidden lg:flex flex-col items-center gap-1.5 px-8">
      <span className="text-[10px] font-mono font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">Efficiency</span>
      <span className="text-xl font-bold text-tertiary">{successRate}%</span>
    </div>

    <div className="hidden xl:flex flex-col items-end gap-1.5 px-8 border-x border-white/5">
      <span className="text-[10px] font-mono font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">Cluster Distribution</span>
      <div className="flex -space-x-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-6 h-6 rounded-full bg-surface-container-highest border-2 border-surface flex items-center justify-center text-[10px] font-bold text-primary">
            {activeNodes[i] || '0'}
          </div>
        ))}
      </div>
    </div>

    <div className="flex gap-2">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlay?.();
        }}
        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-on-surface-variant hover:bg-primary/20 hover:text-primary transition-all"
      >
        {status === 'Running' ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <button className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-xl text-on-surface-variant hover:bg-white/10 transition-all">
        <MoreHorizontal size={18} />
      </button>
    </div>
  </div>
);

export default function Automations() {
  const { data, isLoading } = useWorkflowsList({ page: 1, limit: 50 });
  const { execute } = useWorkflowMutations();
  const animations = (data?.items ?? []).map(mapWorkflowToAutomationRow);
  const activeCount = (data?.items ?? []).filter((w) => w.isActive).length;
  const stats = [
    { label: 'Active Workflows', value: String(activeCount), color: 'text-primary' },
    { label: 'Total Workflows', value: String(data?.meta.total ?? 0), color: 'text-on-surface' },
    { label: 'Scheduled', value: String((data?.items ?? []).filter((w) => w.cronExpression).length), color: 'text-tertiary' },
    { label: 'Health Score', value: data?.meta.total ? '99' : '—', color: 'text-primary' },
  ];

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">Automations</h2>
          <p className="text-on-surface-variant text-body-md mt-2 max-w-2xl">
            Configure serverless event-driven triggers and cron-scheduled tasks across your global agent fleet.
          </p>
        </div>
        <button className="flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl font-bold shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all ring-1 ring-white/20">
          <Plus size={20} className="text-on-primary" />
          <span className="text-on-primary">New Automation</span>
        </button>
      </div>

      {/* Grid Stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {stats.map(stat => (
          <div key={stat.label} className="glass-panel p-6 rounded-3xl group cursor-default border-white/5 hover:border-primary/20 transition-all">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant opacity-40 uppercase tracking-widest">{stat.label}</span>
            <div className={cn("text-3xl font-black mt-2", stat.color)}>{stat.value}</div>
          </div>
        ))}
      </section>

      {/* List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-6 mb-2">
            <div className="flex items-center gap-3 text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-widest opacity-60">
              <Activity size={12} />
              Automation Engine (Live)
            </div>
            <button className="text-[10px] font-mono font-bold text-primary hover:underline uppercase tracking-widest">
              View Analytics <ArrowUpRight size={10} className="inline ml-1" />
            </button>
        </div>
        {isLoading && <p className="text-on-surface-variant px-6">Loading workflows…</p>}
        {!isLoading && animations.length === 0 && (
          <p className="text-on-surface-variant px-6">No workflows yet.</p>
        )}
        {animations.map((a, i) => (
          <motion.div 
            key={a.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <AutomationRow
              {...a}
              onPlay={() => execute.mutate(a.id)}
            />
          </motion.div>
        ))}
      </div>

      {/* Hero Tip */}
      <div className="mt-16 p-8 rounded-3xl bg-surface-container-high/40 border border-white/5 flex items-center justify-between gap-12">
         <div className="flex items-center gap-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group transition-all">
               <ShieldCheck size={32} />
            </div>
            <div className="max-w-xl">
               <h4 className="text-xl font-bold mb-1">Automated Failover Security</h4>
               <p className="text-on-surface-variant text-sm leading-relaxed">System-level protections are enabled. Automation tasks that exceed memory or network thresholds are strictly isolated and throttled to prevent resource exhaustion across nodes.</p>
            </div>
         </div>
         <button className="px-8 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all font-bold text-sm tracking-tight">
           Configure Guards
         </button>
      </div>
    </div>
  );
}
