import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Terminal, 
  Monitor, 
  Laptop, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Copy, 
  ArrowRight, 
  RotateCcw, 
  Send, 
  ExternalLink, 
  Trash2,
  Filter,
  Users,
  Activity,
  Cpu,
  Database,
  Globe,
  HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import { useAgentDetail, useAgentsList, useAgentMutations } from '@/src/hooks/useAgents';
import type { Agent } from '@/src/types/api';
import { useTasksList } from '@/src/hooks/useTasks';
import { mapAgentToCard } from '@/src/lib/mappers';
import {
  clusterFilterLabel,
  filterAgentsByCluster,
  isAgentClusterFilter,
  isAgentStatusFilter,
  nextClusterFilter,
  nextStatusFilter,
  statusFilterLabel,
  type AgentClusterFilter,
  type AgentStatusFilter,
} from '@/src/lib/agentFilters';
import { apiErrorMessage } from '@/src/lib/api';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  YAxis, 
  Tooltip 
} from 'recharts';

const AGENT_OS_OPTIONS = ['Windows 11', 'Windows 10', 'Linux', 'macOS', 'Other'] as const;

const defaultRegForm = () => ({
  name: '',
  os: 'Windows 11',
});

function isAgentConnected(status?: Agent['status']): boolean {
  return status === 'ONLINE' || status === 'BUSY';
}

function shortAgentId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

type AgentCardProps = {
  name: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'IDLE';
  hostname: string;
  os: string;
  ip: string;
  activeTask: 'Yes' | 'No';
  cpuPercent: number;
  cpuLabel: string;
  showCpuBar: boolean;
  ramPercent: number;
  ramLabel: string;
  showRamBar: boolean;
  lastSeen: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
};

const AgentCard = ({
  name,
  status,
  hostname,
  os,
  ip,
  activeTask,
  cpuPercent,
  cpuLabel,
  showCpuBar,
  ramPercent,
  ramLabel,
  showRamBar,
  lastSeen,
  icon: Icon,
  onClick,
}: AgentCardProps) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, scale: 1.01 }}
    onClick={onClick}
    className="glass-card p-6 rounded-2xl group cursor-pointer transition-all duration-300 border border-white/5 hover:border-primary/40 relative overflow-hidden flex flex-col h-full shadow-lg hover:shadow-primary/5"
  >
    <motion.div className="flex justify-between items-start mb-6">
      <motion.div className="flex gap-4 min-w-0">
        <motion.div className="w-14 h-14 shrink-0 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors ring-1 ring-white/5 group-hover:ring-primary/20 shadow-inner">
          <Icon size={28} />
        </motion.div>
        <motion.div className="space-y-1 min-w-0">
          <h4 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-tight truncate">
            {name}
          </h4>
          <p className="text-[11px] font-mono text-on-surface-variant/60 truncate" title={hostname}>
            {hostname}
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        className={cn(
          'shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border',
          status === 'ONLINE'
            ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
            : status === 'BUSY'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-white/5 text-on-surface-variant border-white/10',
        )}
      >
        <motion.div
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            status === 'ONLINE'
              ? 'bg-tertiary shadow-[0_0_8px_#68f5b8]'
              : status === 'BUSY'
                ? 'bg-primary animate-pulse shadow-[0_0_8px_#a4e6ff]'
                : 'bg-on-surface-variant/40',
          )}
        />
        {status}
      </motion.div>
    </motion.div>

    <div className="space-y-4 flex-1">
      <motion.div className="flex justify-between items-center text-xs">
        <span className="text-on-surface-variant/70 font-medium">Active Task</span>
        <span
          className={cn(
            'font-bold py-1 px-2 rounded-lg border text-[10px] uppercase tracking-wider',
            activeTask === 'Yes'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-white/5 text-on-surface-variant/60 border-white/10',
          )}
        >
          {activeTask}
        </span>
      </motion.div>

      <motion.div className="grid grid-cols-2 gap-4">
        <motion.div className="space-y-1">
          <motion.div className="flex items-center gap-1.5 opacity-60">
            <Cpu size={12} className="text-primary" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest">CPU</span>
          </motion.div>
          <motion.div className="text-sm font-bold text-on-surface font-mono">{cpuLabel}</motion.div>
          {showCpuBar ? (
            <motion.div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  cpuPercent > 80 ? 'bg-error' : cpuPercent > 50 ? 'bg-primary' : 'bg-tertiary',
                )}
                style={{ width: `${cpuPercent}%` }}
              />
            </motion.div>
          ) : null}
        </motion.div>
        <motion.div className="space-y-1">
          <motion.div className="flex items-center gap-1.5 opacity-60">
            <Database size={12} className="text-tertiary" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest">RAM</span>
          </motion.div>
          <motion.div className="text-sm font-bold text-on-surface font-mono">{ramLabel}</motion.div>
          {showRamBar ? (
            <motion.div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-tertiary rounded-full transition-all duration-500"
                style={{ width: `${ramPercent}%` }}
              />
            </motion.div>
          ) : null}
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
        <motion.div className="space-y-1 min-w-0">
          <motion.div className="flex items-center gap-1.5 opacity-60">
            <Monitor size={12} className="text-primary" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest">OS</span>
          </motion.div>
          <motion.div className="text-sm font-medium text-on-surface truncate" title={os}>
            {os}
          </motion.div>
        </motion.div>
        <motion.div className="space-y-1 min-w-0">
          <motion.div className="flex items-center gap-1.5 opacity-60">
            <Globe size={12} className="text-tertiary" />
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest">IP</span>
          </motion.div>
          <motion.div className="text-sm font-medium text-on-surface font-mono truncate" title={ip}>
            {ip}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>

    <motion.div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-center text-[10px] font-mono tracking-[0.1em] text-on-surface-variant/50">
      <motion.div className="flex items-center gap-2 min-w-0">
        <Clock size={12} className="opacity-60 shrink-0" />
        <span className="truncate">
          <span className="uppercase tracking-wider text-on-surface-variant/40 mr-1.5">Last seen</span>
          {lastSeen}
        </span>
      </motion.div>
      <motion.div className="flex items-center gap-1.5 text-primary font-bold opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 shrink-0">
        <span>Manage</span>
        <ArrowRight size={12} />
      </motion.div>
    </motion.div>
  </motion.div>
);

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showDecommissionConfirm, setShowDecommissionConfirm] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [regData, setRegData] = useState(defaultRegForm);
  const [regCreated, setRegCreated] = useState<Agent | null>(null);

  // Mock performance data for charts
  const performanceData = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      time: i,
      cpu: 30 + Math.random() * 40,
      memory: 45 + Math.random() * 20,
      network: 10 + Math.random() * 80,
      disk: 5 + Math.random() * 15
    }));
  }, [selectedAgent]);

  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>(() => {
    const s = searchParams.get('status');
    return isAgentStatusFilter(s) ? s : 'all';
  });
  const [clusterFilter, setClusterFilter] = useState<AgentClusterFilter>(() => {
    const c = searchParams.get('cluster');
    return isAgentClusterFilter(c) ? c : 'all';
  });
  const AGENT_PAGE_LIMIT = 12;
  const CLUSTER_FETCH_LIMIT = 200;
  const useClusterClientPaging = clusterFilter !== 'all';

  const { data: agentsPage, isLoading } = useAgentsList({
    page: useClusterClientPaging ? 1 : page,
    limit: useClusterClientPaging ? CLUSTER_FETCH_LIMIT : AGENT_PAGE_LIMIT,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });
  const { data: runningTasksPage } = useTasksList({
    page: 1,
    limit: 200,
    status: 'RUNNING',
  });
  const { create, remove, regenerateKey } = useAgentMutations();
  const regAgentLive = useAgentDetail(
    regCreated?.id,
    showRegistration && regStep === 3 ? 3_000 : undefined,
  );

  const runningAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const task of runningTasksPage?.items ?? []) {
      if (task.agentId) ids.add(task.agentId);
    }
    return ids;
  }, [runningTasksPage?.items]);

  const filteredRaw = useMemo(
    () => filterAgentsByCluster(agentsPage?.items ?? [], clusterFilter),
    [agentsPage?.items, clusterFilter],
  );

  const displayTotal = useClusterClientPaging
    ? filteredRaw.length
    : (agentsPage?.meta.total ?? 0);

  const pagedRaw = useMemo(() => {
    if (!useClusterClientPaging) return filteredRaw;
    const start = (page - 1) * AGENT_PAGE_LIMIT;
    return filteredRaw.slice(start, start + AGENT_PAGE_LIMIT);
  }, [filteredRaw, useClusterClientPaging, page]);

  const agents = pagedRaw.map((a) =>
    mapAgentToCard(a, runningAgentIds.has(a.id)),
  );

  useEffect(() => {
    setPage(1);
  }, [statusFilter, clusterFilter]);

  const [apiError, setApiError] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});

  const activeAgentKey =
    selectedAgent?._raw?.id ? revealedKeys[selectedAgent._raw.id] : undefined;

  const regAgentKey = regCreated?.id
    ? (revealedKeys[regCreated.id] ?? regCreated.agentKey)
    : undefined;

  const regAgentSnapshot = regAgentLive.data ?? regCreated;

  const openRegistration = () => {
    setRegData(defaultRegForm());
    setRegCreated(null);
    setRegStep(1);
    setApiError('');
    setShowRegistration(true);
  };

  const closeRegistration = () => {
    setShowRegistration(false);
    setRegStep(1);
    setRegCreated(null);
    setRegData(defaultRegForm());
    setApiError('');
  };

  const handleCreateAgent = async () => {
    setApiError('');
    try {
      const created = await create.mutateAsync({
        name: regData.name.trim(),
        os: regData.os,
      });
      setRegCreated(created);
      if (created.agentKey) {
        setRevealedKeys((prev) => ({ ...prev, [created.id]: created.agentKey! }));
      }
      setRegStep(2);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  const copyRegAgentKey = async () => {
    if (!regAgentKey) return;
    try {
      await navigator.clipboard.writeText(regAgentKey);
    } catch {
      setApiError('Could not copy to clipboard.');
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent?._raw?.id) return;
    try {
      await remove.mutateAsync(selectedAgent._raw.id);
      setShowDecommissionConfirm(false);
      setSelectedAgent(null);
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  const handleRegenerateKey = async () => {
    if (!selectedAgent?._raw?.id) return;
    setApiError('');
    try {
      const updated = await regenerateKey.mutateAsync(selectedAgent._raw.id);
      if (updated.agentKey) {
        setRevealedKeys((prev) => ({ ...prev, [updated.id]: updated.agentKey! }));
      }
      setSelectedAgent(mapAgentToCard(updated));
    } catch (err) {
      setApiError(apiErrorMessage(err));
    }
  };

  const copyAgentKey = async () => {
    if (!activeAgentKey) return;
    try {
      await navigator.clipboard.writeText(activeAgentKey);
    } catch {
      setApiError('Could not copy to clipboard.');
    }
  };

  return (
    <div className="h-full relative pb-20">
      {/* Page Header */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">Agent Fleet</h2>
          <p className="text-on-surface-variant text-body-md mt-1">
            Monitor and manage {displayTotal} compute instance{displayTotal === 1 ? '' : 's'}
            {clusterFilter !== 'all' ? ` (${clusterFilterLabel(clusterFilter)})` : ''}.
          </p>
        </div>
        <div className="flex gap-3">
           <button
             type="button"
             onClick={() => setStatusFilter((s) => nextStatusFilter(s))}
             className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold tracking-tight"
           >
             <Filter size={16} className="text-on-surface-variant" />
             Status: {statusFilterLabel(statusFilter)}
           </button>
           <button
             type="button"
             onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
             className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold tracking-tight"
           >
             <Users size={16} className="text-on-surface-variant" />
             Cluster: {clusterFilterLabel(clusterFilter)}
           </button>
        </div>
      </div>

       {/* Agent Grid */}
       <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading && (
            <p className="text-on-surface-variant col-span-3">Loading agents…</p>
          )}
          {!isLoading && agents.length === 0 && (
            <p className="text-on-surface-variant col-span-3">
              {statusFilter !== 'all' || clusterFilter !== 'all'
                ? 'No agents match the current filters.'
                : 'No agents registered yet.'}
            </p>
          )}
          {agents.map((agent) => (
            <AgentCard
              key={agent._raw.id}
              {...agent}
              onClick={() => {
                setSelectedAgent(agent);
                setApiError('');
              }}
            />
          ))}
       </div>

       <Pagination
         page={page}
         limit={AGENT_PAGE_LIMIT}
         total={displayTotal}
         onPageChange={setPage}
         className="mt-8"
       />

       {/* Quick Registration Card */}
       <section className="glass-card rounded-2xl p-8 mt-10 bg-gradient-to-r from-primary/10 to-transparent flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 lg:gap-12 group">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <Terminal className="text-primary" size={24} />
              <h3 className="text-2xl font-bold">Quick Registration</h3>
            </div>
            <p className="text-on-surface-variant text-body-md leading-relaxed mb-6">Scale your agent fleet in seconds. Run this installation script on your remote host to connect it to the DATN Console ecosystem automatically.</p>
            <div className="bg-surface-container-lowest/80 rounded-xl border border-white/5 p-4 flex items-center gap-4 group/box ring-1 ring-transparent hover:ring-primary/20 transition-all">
              <code className="font-mono text-xs text-primary flex-1 truncate">curl -sSL https://get.datn.io/install.sh | bash -s -- --token=eyJhbGciOiJIUzI1NiI...</code>
              <button className="p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-on-surface-variant transition-all hover:text-primary">
                <Copy size={16} />
              </button>
            </div>
          </div>
          <div className="shrink-0">
             <button 
              type="button"
              onClick={openRegistration}
              className="px-10 py-5 bg-primary text-on-primary rounded-2xl font-bold text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-3"
             >
               <Plus size={24} />
               Register New Agent
             </button>
          </div>
       </section>

       {/* Drawer Detail */}
       <AnimatePresence>
         {selectedAgent && (
           <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAgent(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.aside 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[480px] bg-surface shadow-[-50px_0_100px_rgba(0,0,0,0.5)] border-l border-white/10 z-[70] flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedAgent(null)}
                    className="p-2 hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface"
                  >
                    <ArrowRight size={20} />
                  </button>
                  <h3 className="text-2xl font-bold">Agent Details</h3>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-tertiary/10 rounded-full border border-tertiary/20">
                   <CheckCircle2 size={14} className="text-tertiary" />
                   <span className="font-mono text-[10px] font-bold text-tertiary uppercase tracking-tighter">Verified</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Uptime', value: '12d 04h', color: 'text-on-surface' },
                    { label: 'Success Rate', value: '99.8%', color: 'text-tertiary' },
                    { label: 'Latency', value: '42ms', color: 'text-primary' },
                    { label: 'Memory', value: '1.2 / 8GB', color: 'text-on-surface' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-surface-container-high/50 p-5 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
                      <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest mb-1 opacity-60">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Performance Metrics */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em]">Telemetry Feed (1H)</h4>
                    <Activity size={14} className="text-primary/50" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'CPU Usage', key: 'cpu', icon: Cpu, color: '#a4e6ff', unit: '%' },
                      { label: 'RAM Utility', key: 'memory', icon: Database, color: '#68f5b8', unit: '%' },
                      { label: 'Net Throughput', key: 'network', icon: Globe, color: '#d0bcff', unit: 'MB/s' },
                      { label: 'Disk I/O', key: 'disk', icon: HardDrive, color: '#facc15', unit: 'OPS' },
                    ].map((metric) => (
                      <div key={metric.label} className="bg-surface-container-low border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <metric.icon size={12} className="text-on-surface-variant/60" />
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">{metric.label}</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold" style={{ color: metric.color }}>
                            {performanceData[performanceData.length - 1][metric.key as keyof typeof performanceData[0]].toFixed(1)}{metric.unit}
                          </span>
                        </div>
                        <div className="h-16 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={performanceData}>
                              <defs>
                                <linearGradient id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <Area 
                                type="monotone" 
                                dataKey={metric.key} 
                                stroke={metric.color} 
                                fillOpacity={1} 
                                fill={`url(#gradient-${metric.key})`} 
                                strokeWidth={2}
                                isAnimationActive={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Secret Key */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] px-1">Agent Secret Key</h4>
                  <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-5 space-y-3">
                    <p className="font-mono text-xs text-on-surface break-all">
                      {activeAgentKey ?? 'Regenerate to reveal a new key (shown once).'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!activeAgentKey}
                        onClick={() => void copyAgentKey()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold font-mono disabled:opacity-30"
                      >
                        <Copy size={16} />
                        COPY
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRegenerateKey()}
                        disabled={regenerateKey.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl text-xs font-bold disabled:opacity-30"
                      >
                        <RotateCcw size={16} className={regenerateKey.isPending ? 'animate-spin' : ''} />
                        Regenerate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Logs */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em]">Live Agent Logs</h4>
                    <div className="flex items-center gap-1.5 animate-pulse">
                      <div className="w-1 h-1 rounded-full bg-tertiary" />
                      <span className="text-[9px] font-mono text-tertiary font-bold tracking-tight">LIVE</span>
                    </div>
                  </div>
                  <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-6 font-mono text-[11px] leading-relaxed h-48 overflow-y-auto custom-scrollbar space-y-2">
                    <div className="flex gap-3">
                      <span className="text-on-surface-variant opacity-40">[14:32:01]</span>
                      <span className="text-tertiary font-bold">INFO</span>
                      <span className="text-on-surface-variant/70">Socket connection established with main cluster.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-on-surface-variant opacity-40">[14:32:05]</span>
                      <span className="text-primary font-bold">TASK</span>
                      <span className="text-on-surface-variant/70">Pulled payload for task: <span className="text-on-surface font-bold">{selectedAgent?.task || 'IDLE'}</span></span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-on-surface-variant opacity-40">[14:32:12]</span>
                      <span className="text-tertiary font-bold">INFO</span>
                      <span className="text-on-surface-variant/70">Allocating 480MB VRAM for operation stability.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-on-surface-variant opacity-40">[14:32:45]</span>
                      <span className={cn("font-bold", selectedAgent?.status === 'BUSY' ? "text-primary" : "text-tertiary")}>
                        {selectedAgent?.status === 'BUSY' ? 'BUSY' : 'IDLE'}
                      </span>
                      <span className="text-on-surface-variant/70">
                         {selectedAgent?.status === 'BUSY' ? 'Processing batch chunks [102/400]...' : 'Awaiting next execution window...'}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-on-surface-variant opacity-40">[14:35:10]</span>
                      <span className="text-on-surface-variant/40">Keep-alive heartbeat sent.</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] px-1">Quick Actions</h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Force Restart Session', icon: RotateCcw },
                      { label: 'Send Ad-hoc Task', icon: Send },
                      { label: 'Open Linked Automation', icon: ExternalLink },
                    ].map((action) => (
                      <button 
                        key={action.label} 
                        className="w-full flex items-center justify-between group/item p-5 bg-white/2 hover:bg-white/5 rounded-2xl border border-white/5 transition-all text-sm font-semibold"
                      >
                         <div className="flex items-center gap-4">
                           <action.icon size={18} className="text-primary group-hover/item:scale-110 transition-transform" />
                           {action.label}
                         </div>
                         <ArrowRight size={16} className="text-on-surface-variant opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-10 mt-10 border-t border-white/5">
                   <button 
                    onClick={() => setShowDecommissionConfirm(true)}
                    className="w-full p-5 bg-error-container/10 hover:bg-error-container/20 border border-error/20 rounded-2xl flex items-center justify-center gap-3 text-error transition-all group/delete"
                   >
                     <Trash2 size={20} className="group-hover/delete:rotate-12 transition-transform" />
                     <span className="font-bold uppercase tracking-widest text-xs">Revoke & Decommission Agent</span>
                   </button>
                </div>
              </div>
            </motion.aside>

            {/* Decommission Confirmation Modal */}
            <AnimatePresence>
              {showDecommissionConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowDecommissionConfirm(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative w-full max-w-md glass-card bg-surface rounded-3xl p-8 border border-error/20 shadow-[0_20px_50px_rgba(255,180,171,0.1)]"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center text-error mb-6">
                      <AlertCircle size={32} />
                    </div>
                    <h3 className="text-2xl font-bold text-on-surface mb-2">Critical Action</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
                      You are about to decommission <span className="text-on-surface font-bold">"{selectedAgent?.name}"</span>. 
                      This action will revoke all security tokens, terminate active sessions, and wipe local workspace caches. 
                      <span className="block mt-2 font-bold text-error italic">This process is irreversible.</span>
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleDeleteAgent}
                        className="w-full py-4 bg-error text-on-error rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                      >
                        CONFIRM DECOMMISSION
                      </button>
                      <button 
                        onClick={() => setShowDecommissionConfirm(false)}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-on-surface-variant rounded-xl font-bold border border-white/10 transition-all text-sm uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
           </>
         )}
       </AnimatePresence>

       {/* Agent Registration Guided Flow */}
       <AnimatePresence>
         {showRegistration && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={closeRegistration}
               className="absolute inset-0 bg-black/90 backdrop-blur-xl"
             />
             
             <motion.div
               initial={{ opacity: 0, scale: 0.9, y: 30 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 30 }}
               className="relative w-full max-w-2xl glass-card bg-surface rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)]"
             >
               {/* Progress Bar */}
               <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5">
                 <motion.div 
                   initial={{ width: '0%' }}
                   animate={{ width: `${(regStep / 3) * 100}%` }}
                   className="h-full bg-primary shadow-[0_0_15px_#a4e6ff]"
                 />
               </div>

               <div className="p-12">
                 <div className="flex justify-between items-start mb-10">
                   <div>
                     <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em]">Step 0{regStep} / 03</span>
                     <h3 className="text-3xl font-bold text-on-surface mt-2">
                       {regStep === 1 ? 'Identify Your Agent' : regStep === 2 ? 'Establish Connection' : 'Final Configuration'}
                     </h3>
                   </div>
                   <button 
                    onClick={closeRegistration}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
                   >
                     <Plus size={20} className="rotate-45" />
                   </button>
                 </div>

                 <div className="min-h-[300px]">
                   {regStep === 1 && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="space-y-8"
                     >
                       <div className="space-y-3">
                         <label className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">Tên agent</label>
                         <input 
                           type="text"
                           value={regData.name}
                           onChange={(e) => setRegData({...regData, name: e.target.value})}
                           placeholder="e.g. Máy làm việc phòng IT"
                           className="w-full bg-surface-container-highest border border-white/5 rounded-2xl p-5 text-lg font-bold focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/20"
                         />
                         <p className="text-[10px] text-on-surface-variant/50 ml-1 italic">
                           Tên hiển thị trên console — hostname thật do agent gửi khi kết nối.
                         </p>
                       </div>
                       <div className="space-y-3">
                         <label className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">
                           Hệ điều hành
                         </label>
                         <select
                           value={regData.os}
                           onChange={(e) => setRegData({ ...regData, os: e.target.value })}
                           className="w-full bg-surface-container-highest border border-white/5 rounded-2xl p-5 text-lg font-bold focus:outline-none focus:border-primary/40 transition-all appearance-none"
                         >
                           {AGENT_OS_OPTIONS.map((os) => (
                             <option key={os} value={os}>
                               {os}
                             </option>
                           ))}
                         </select>
                       </div>
                     </motion.div>
                   )}

                   {regStep === 2 && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="space-y-8"
                     >
                       <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10">
                         <div className="flex items-center gap-4 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
                              <Globe size={20} />
                            </div>
                            <h4 className="font-bold text-on-surface">Secure Connection Token</h4>
                         </div>
                         <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                           Dán <b>agentKey</b> vào cấu hình agent (tray → Cài đặt hoặc{' '}
                           <code className="text-primary">agent.env</code>), rồi khởi động lại dịch vụ.
                           {regCreated?.id ? (
                             <>
                               {' '}
                               ID:{' '}
                               <span className="font-mono text-on-surface">
                                 {shortAgentId(regCreated.id)}
                               </span>
                             </>
                           ) : null}
                         </p>
                         <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-5 flex items-center justify-between group/token">
                            <code className="font-mono text-xs text-primary truncate mr-4 tracking-widest">
                              {regAgentKey ?? '—'}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copyRegAgentKey()}
                              disabled={!regAgentKey}
                              className="flex items-center gap-2 text-primary font-bold font-mono text-xs hover:brightness-125 shrink-0 disabled:opacity-40"
                            >
                               <Copy size={16} />
                               COPY
                            </button>
                         </div>
                       </div>
                     </motion.div>
                   )}

                   {regStep === 3 && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="space-y-8"
                     >
                       <motion.div
                         className={cn(
                           'rounded-3xl p-6 border flex items-start gap-4',
                           isAgentConnected(regAgentSnapshot?.status)
                             ? 'bg-tertiary/10 border-tertiary/30'
                             : 'bg-secondary/10 border-secondary/20',
                         )}
                       >
                         {isAgentConnected(regAgentSnapshot?.status) ? (
                           <CheckCircle2 className="text-tertiary shrink-0" size={28} />
                         ) : (
                           <Clock className="text-secondary shrink-0 animate-pulse" size={28} />
                         )}
                         <div>
                           <h4 className="font-bold text-on-surface">
                             {isAgentConnected(regAgentSnapshot?.status)
                               ? 'Agent đã kết nối'
                               : 'Chưa thấy agent online'}
                           </h4>
                           <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                             {isAgentConnected(regAgentSnapshot?.status)
                               ? 'Socket agent đã xác thực với server. Có thể giao task.'
                               : 'Đang chờ agent chạy với agentKey đúng. Trang tự làm mới mỗi 3 giây.'}
                           </p>
                         </div>
                       </motion.div>

                       <div className="bg-surface-container-high/50 rounded-3xl p-8 border border-white/5">
                         <h4 className="font-bold mb-4">Thông tin thực tế</h4>
                         <div className="space-y-3 text-sm">
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">Trạng thái</span>
                             <span
                               className={cn(
                                 'font-mono font-bold uppercase',
                                 isAgentConnected(regAgentSnapshot?.status)
                                   ? 'text-tertiary'
                                   : 'text-on-surface-variant',
                               )}
                             >
                               {regAgentSnapshot?.status ?? 'OFFLINE'}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">Agent ID</span>
                             <span className="text-primary font-mono text-right break-all">
                               {regCreated?.id ?? '—'}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">Tên</span>
                             <span className="text-on-surface text-right">{regAgentSnapshot?.name ?? '—'}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">OS</span>
                             <span className="text-on-surface text-right">
                               {regAgentSnapshot?.os ?? regData.os ?? '—'}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">Hostname</span>
                             <span className="text-on-surface font-mono text-right">
                               {regAgentSnapshot?.hostname?.trim() || '—'}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">IP</span>
                             <span className="text-on-surface font-mono text-right">
                               {regAgentSnapshot?.ip?.trim() || '—'}
                             </span>
                           </div>
                           <div className="flex justify-between gap-4">
                             <span className="text-on-surface-variant shrink-0">Lần thấy gần nhất</span>
                             <span className="text-on-surface text-right">
                               {regAgentSnapshot?.lastSeenAt || regAgentSnapshot?.lastHeartbeatAt
                                 ? new Date(
                                     regAgentSnapshot.lastSeenAt ??
                                       regAgentSnapshot.lastHeartbeatAt!,
                                   ).toLocaleString()
                                 : '—'}
                             </span>
                           </div>
                         </div>
                       </div>
                     </motion.div>
                   )}
                 </div>

                 {apiError ? (
                   <p className="mt-6 text-error text-xs font-mono">{apiError}</p>
                 ) : null}

                 <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-4">
                   {regStep === 3 ? (
                     <button
                       type="button"
                       onClick={() => setRegStep(2)}
                       className="flex-1 py-5 bg-white/5 border border-white/10 text-on-surface rounded-2xl font-bold hover:bg-white/10 transition-all"
                     >
                       XEM LẠI KEY
                     </button>
                   ) : null}
                   <button
                    type="button"
                    onClick={() => {
                      if (regStep === 1) {
                        void handleCreateAgent();
                      } else if (regStep === 2) {
                        setRegStep(3);
                      } else {
                        closeRegistration();
                      }
                    }}
                    disabled={
                      (regStep === 1 && !regData.name.trim()) ||
                      (regStep === 2 && !regAgentKey) ||
                      create.isPending
                    }
                    className="flex-[2] py-5 bg-primary text-on-primary rounded-2xl font-bold shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
                   >
                     {regStep === 1 && create.isPending
                       ? 'ĐANG TẠO…'
                       : regStep === 3
                         ? 'HOÀN TẤT'
                         : 'TIẾP TỤC'}
                   </button>
                 </div>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
}
