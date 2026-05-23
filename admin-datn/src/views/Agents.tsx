import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  Terminal, 
  Monitor,
  Laptop,
  Globe,
  Cpu,
  Database,
  Clock,
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  ArrowRight, 
  RotateCcw, 
  Trash2,
  Filter,
  Users,
} from 'lucide-react';
import { AgentCard } from '@/src/components/AgentCard';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import { useAgentDetail, useAgentsList, useAgentMutations } from '@/src/hooks/useAgents';
import type { Agent } from '@/src/types/api';
import { useTasksList } from '@/src/hooks/useTasks';
import { mapAgentToCard, mapAgentToDetails } from '@/src/lib/mappers';
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
import { t } from '@/src/i18n/t';

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

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showDecommissionConfirm, setShowDecommissionConfirm] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [regStep, setRegStep] = useState(1);
  const [regData, setRegData] = useState(defaultRegForm);
  const [regCreated, setRegCreated] = useState<Agent | null>(null);

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

  const agentDetails = useMemo(
    () => (selectedAgent?._raw ? mapAgentToDetails(selectedAgent._raw) : null),
    [selectedAgent],
  );

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
      setApiError(t('common.couldNotCopy'));
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
      setApiError(t('common.couldNotCopy'));
    }
  };

  return (
    <div className="h-full relative pb-20">
      {/* Page Header */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">{t('agents.fleetTitle')}</h2>
          <p className="text-on-surface-variant text-body-md mt-1">
            {displayTotal === 1
              ? t('agents.fleetSubtitleOne')
              : t('agents.fleetSubtitle', { count: displayTotal })}
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
             {t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })}
           </button>
           <button
             type="button"
             onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
             className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold tracking-tight"
           >
             <Users size={16} className="text-on-surface-variant" />
             {t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}
           </button>
        </div>
      </div>

       {/* Agent Grid */}
       <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading && (
            <p className="text-on-surface-variant col-span-3">{t('agents.loading')}</p>
          )}
          {!isLoading && agents.length === 0 && (
            <p className="text-on-surface-variant col-span-3">
              {statusFilter !== 'all' || clusterFilter !== 'all'
                ? t('agents.noMatch')
                : t('agents.noRegistered')}
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
              <h3 className="text-2xl font-bold">{t('agents.quickRegistration')}</h3>
            </div>
            <p className="text-on-surface-variant text-body-md leading-relaxed mb-6">{t('agents.quickRegistrationDesc')}</p>
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
               {t('agents.registerNew')}
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
                  <div className="min-w-0">
                    <h3 className="text-2xl font-bold truncate">{selectedAgent.name}</h3>
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                      {t(`status.${selectedAgent.status}` as 'status.ONLINE')} · {t('time.lastSeenShort', { time: selectedAgent.lastSeen })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                {agentDetails ? (
                  <motion.div className="space-y-3">
                    <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] px-1">
                      {t('agents.machineInfo')}
                    </h4>
                    <div className="bg-surface-container-high/50 rounded-2xl border border-white/5 divide-y divide-white/5">
                      {(
                        [
                          { label: t('common.hostname'), value: agentDetails.hostname, icon: Monitor },
                          { label: t('common.os'), value: agentDetails.os, icon: Laptop },
                          { label: t('common.ip'), value: agentDetails.ip, icon: Globe },
                          { label: t('common.cpu'), value: agentDetails.cpu, icon: Cpu },
                          { label: t('common.ram'), value: agentDetails.ram, icon: Database },
                        ] as const
                      ).map((row) => (
                        <div
                          key={row.label}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                            <row.icon size={14} className="opacity-60" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                              {row.label}
                            </span>
                          </div>
                          <span
                            className={cn(
                              'text-sm font-medium text-on-surface text-right break-all',
                              row.label === t('common.ip') || row.label === t('common.cpu') || row.label === t('common.ram')
                                ? 'font-mono'
                                : '',
                            )}
                            title={row.value}
                          >
                            {row.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-on-surface-variant/50 px-1 italic">
                      {t('agents.machineInfoHint')}
                    </p>
                  </motion.div>
                ) : null}

                {/* Secret Key */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] px-1">{t('agents.agentSecretKey')}</h4>
                  <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-5 space-y-3">
                    <p className="font-mono text-xs text-on-surface break-all">
                      {activeAgentKey ?? t('agents.regenerateHint')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!activeAgentKey}
                        onClick={() => void copyAgentKey()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold font-mono disabled:opacity-30"
                      >
                        <Copy size={16} />
                        {t('common.copy')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRegenerateKey()}
                        disabled={regenerateKey.isPending}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary/20 text-primary hover:bg-primary/30 rounded-xl text-xs font-bold disabled:opacity-30"
                      >
                        <RotateCcw size={16} className={regenerateKey.isPending ? 'animate-spin' : ''} />
                        {t('agents.regenerate')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-10 mt-10 border-t border-white/5">
                   <button 
                    onClick={() => setShowDecommissionConfirm(true)}
                    className="w-full p-5 bg-error-container/10 hover:bg-error-container/20 border border-error/20 rounded-2xl flex items-center justify-center gap-3 text-error transition-all group/delete"
                   >
                     <Trash2 size={20} className="group-hover/delete:rotate-12 transition-transform" />
                     <span className="font-bold uppercase tracking-widest text-xs">{t('agents.revokeDecommission')}</span>
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
                    <h3 className="text-2xl font-bold text-on-surface mb-2">{t('agents.criticalAction')}</h3>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-8">
                      {t('agents.decommissionConfirm', { name: selectedAgent?.name ?? '' })}{' '}
                      {t('agents.decommissionWarning')}{' '}
                      <span className="block mt-2 font-bold text-error italic">{t('common.irreversible')}</span>
                    </p>
                    
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleDeleteAgent}
                        className="w-full py-4 bg-error text-on-error rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all"
                      >
                        {t('agents.confirmDecommission')}
                      </button>
                      <button 
                        onClick={() => setShowDecommissionConfirm(false)}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-on-surface-variant rounded-xl font-bold border border-white/10 transition-all text-sm uppercase tracking-widest"
                      >
                        {t('common.cancel')}
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
                     <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em]">{t('agents.step', { n: regStep })}</span>
                     <h3 className="text-3xl font-bold text-on-surface mt-2">
                       {regStep === 1 ? t('agents.step1Title') : regStep === 2 ? t('agents.step2Title') : t('agents.step3Title')}
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
                         <label className="text-lg font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('agents.agentName')}</label>
                         <input 
                           type="text"
                           value={regData.name}
                           onChange={(e) => setRegData({...regData, name: e.target.value})}
                           placeholder={t('agents.agentNamePlaceholder')}
                           className="w-full bg-surface-container-highest border border-white/5 rounded-2xl p-5 text-lg font-bold focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/20"
                         />
                         <p className="text-[10px] text-on-surface-variant/50 ml-1 italic">
                           {t('agents.agentNameHint')}
                         </p>
                       </div>
                       <div className="space-y-3">
                         <label className="text-lg font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">
                           {t('common.os')}
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
                            <h4 className="font-bold text-on-surface">{t('agents.secureToken')}</h4>
                         </div>
                         <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
                           {t('agents.step2KeyHelp')}
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
                              {regAgentKey ?? t('common.emDash')}
                            </code>
                            <button
                              type="button"
                              onClick={() => void copyRegAgentKey()}
                              disabled={!regAgentKey}
                              className="flex items-center gap-2 text-primary font-bold font-mono text-xs hover:brightness-125 shrink-0 disabled:opacity-40"
                            >
                               <Copy size={16} />
                               {t('common.copy')}
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
                               ? t('agents.connectedTitle')
                               : t('agents.notConnectedTitle')}
                           </h4>
                           <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                             {isAgentConnected(regAgentSnapshot?.status)
                               ? t('agents.connectedDesc')
                               : t('agents.notConnectedDesc')}
                           </p>
                         </div>
                       </motion.div>

                       <div className="bg-surface-container-high/50 rounded-3xl p-8 border border-white/5">
                         <h4 className="font-bold mb-4">{t('agents.realInfo')}</h4>
                         <div className="space-y-3 text-sm">
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('common.status')}</span>
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
                             <span className="text-on-surface-variant shrink-0">{t('agents.agentId')}</span>
                             <span className="text-primary font-mono text-right break-all">
                               {regCreated?.id ?? t('common.emDash')}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('agents.displayNameLabel')}</span>
                             <span className="text-on-surface text-right">{regAgentSnapshot?.name ?? t('common.emDash')}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('common.os')}</span>
                             <span className="text-on-surface text-right">
                               {regAgentSnapshot?.os ?? regData.os ?? t('common.emDash')}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('common.hostname')}</span>
                             <span className="text-on-surface font-mono text-right">
                               {regAgentSnapshot?.hostname?.trim() || t('common.emDash')}
                             </span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 pb-2 gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('common.ip')}</span>
                             <span className="text-on-surface font-mono text-right">
                               {regAgentSnapshot?.ip?.trim() || t('common.emDash')}
                             </span>
                           </div>
                           <div className="flex justify-between gap-4">
                             <span className="text-on-surface-variant shrink-0">{t('time.lastSeen')}</span>
                             <span className="text-on-surface text-right">
                               {regAgentSnapshot?.lastSeenAt || regAgentSnapshot?.lastHeartbeatAt
                                 ? new Date(
                                     regAgentSnapshot.lastSeenAt ??
                                       regAgentSnapshot.lastHeartbeatAt!,
                                   ).toLocaleString()
                                 : t('common.emDash')}
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
                       {t('agents.reviewKey')}
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
                       ? t('agents.creating')
                       : regStep === 3
                         ? t('agents.finish')
                         : t('agents.continue')}
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
