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
  ArrowRight, 
  RotateCcw, 
  Trash2,
  Filter,
  Users,
} from 'lucide-react';
import { AgentCard } from '@/src/components/AgentCard';
import { AgentRemoteAccessPanel } from '@/src/components/AgentRemoteAccessPanel';
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
import { CopyButton } from '@/src/components/CopyButton';

const QUICK_INSTALL_CURL =
  'curl -sSL https://get.stationhub.io/install.sh | bash -s -- --token=eyJhbGciOiJIUzI1NiI...';

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
  const { create, remove, regenerateKey, syncChromeProfiles, wakeAgent, updateRemoteAccess } =
    useAgentMutations();
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

  const selectedAgentId = selectedAgent?._raw?.id as string | undefined;
  const { data: selectedAgentLive } = useAgentDetail(selectedAgentId, 5_000);

  const agentDetails = useMemo(
    () =>
      selectedAgentLive
        ? mapAgentToDetails(selectedAgentLive)
        : selectedAgent?._raw
          ? mapAgentToDetails(selectedAgent._raw)
          : null,
    [selectedAgent, selectedAgentLive],
  );

  const chromeProfilesForDrawer =
    selectedAgentLive?.chromeProfiles ?? selectedAgent?._raw?.chromeProfiles ?? [];
  const selectedAgentStatus =
    selectedAgentLive?.status ?? selectedAgent?._raw?.status;
  const selectedAgentRaw: Agent | undefined = selectedAgentLive ?? selectedAgent?._raw;

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

  return (
    <div className="relative pb-12 sm:pb-20 min-w-0 max-w-full space-y-6 sm:space-y-0">
      <header className="mb-6 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">{t('agents.fleetTitle')}</h2>
          <p className="text-on-surface-variant text-sm sm:text-body-md mt-1 break-words">
            {displayTotal === 1
              ? t('agents.fleetSubtitleOne')
              : t('agents.fleetSubtitle', { count: displayTotal })}
            {clusterFilter !== 'all' ? ` (${clusterFilterLabel(clusterFilter)})` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
           <button
             type="button"
             onClick={() => setStatusFilter((s) => nextStatusFilter(s))}
             className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs sm:text-sm font-bold tracking-tight min-w-0 flex-1 sm:flex-none"
           >
             <Filter size={16} className="text-on-surface-variant shrink-0" />
             <span className="truncate">{t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })}</span>
           </button>
           <button
             type="button"
             onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
             className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs sm:text-sm font-bold tracking-tight min-w-0 flex-1 sm:flex-none"
           >
             <Users size={16} className="text-on-surface-variant shrink-0" />
             <span className="truncate">{t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}</span>
           </button>
        </div>
      </header>

       <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
         className="mt-6 sm:mt-8"
       />

       <section className="glass-card rounded-2xl p-4 sm:p-6 lg:p-8 mt-8 sm:mt-10 bg-gradient-to-r from-primary/10 to-transparent flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 lg:gap-12 group min-w-0 overflow-hidden">
          <div className="w-full min-w-0 max-w-2xl flex-1">
            <div className="flex items-center gap-3 mb-3 min-w-0">
              <Terminal className="text-primary shrink-0" size={24} />
              <h3 className="text-xl sm:text-2xl font-bold min-w-0">{t('agents.quickRegistration')}</h3>
            </div>
            <p className="text-on-surface-variant text-body-md leading-relaxed mb-6 break-words">{t('agents.quickRegistrationDesc')}</p>
            <div className="bg-surface-container-lowest/80 rounded-xl border border-white/5 p-3 sm:p-4 flex items-center gap-3 min-w-0 overflow-hidden group/box ring-1 ring-transparent hover:ring-primary/20 transition-all">
              <code className="font-mono text-[10px] sm:text-xs text-primary flex-1 min-w-0 truncate">{QUICK_INSTALL_CURL}</code>
              <CopyButton
                text={QUICK_INSTALL_CURL}
                iconOnly
                iconSize={16}
                className="shrink-0 p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-on-surface-variant hover:text-primary"
                onError={() => setApiError(t('common.couldNotCopy'))}
              />
            </div>
          </div>
          <div className="shrink-0 w-full lg:w-auto lg:self-center">
             <button 
              type="button"
              onClick={openRegistration}
              className="w-full lg:w-auto px-6 sm:px-10 py-4 sm:py-5 bg-primary text-on-primary rounded-2xl font-bold text-base sm:text-lg shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
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
              className="fixed top-0 right-0 h-[100dvh] w-full max-w-[480px] bg-surface shadow-[-50px_0_100px_rgba(0,0,0,0.5)] border-l border-white/10 z-[70] flex flex-col min-w-0"
            >
              <div className="p-4 sm:p-6 lg:p-8 border-b border-white/5 flex items-center gap-3 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setSelectedAgent(null)}
                    className="p-2 hover:bg-white/5 rounded-full transition-all text-on-surface-variant hover:text-on-surface shrink-0"
                    aria-label={t('nav.closeSidebar')}
                  >
                    <ArrowRight size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg sm:text-2xl font-bold truncate">{selectedAgent.name}</h3>
                    <p className="text-xs text-on-surface-variant font-mono mt-0.5 truncate">
                      {t(`status.${selectedAgent.status}` as 'status.ONLINE')} · {t('time.lastSeenShort', { time: selectedAgent.lastSeen })}
                    </p>
                  </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-8 sm:space-y-10 custom-scrollbar min-h-0">
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
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4"
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
                  </motion.div>
                ) : null}

                {selectedAgentRaw ? (
                  <AgentRemoteAccessPanel
                    agent={selectedAgentRaw}
                    waking={wakeAgent.isPending}
                    saving={updateRemoteAccess.isPending}
                    wakeError={
                      wakeAgent.isError ? apiErrorMessage(wakeAgent.error) : undefined
                    }
                    saveError={
                      updateRemoteAccess.isError
                        ? apiErrorMessage(updateRemoteAccess.error)
                        : undefined
                    }
                    wakeMessage={
                      wakeAgent.isSuccess ? wakeAgent.data?.message : undefined
                    }
                    onWake={() => {
                      if (!selectedAgentId) return;
                      void wakeAgent.mutateAsync({ id: selectedAgentId });
                    }}
                    onSave={(dto) => {
                      if (!selectedAgentId) return;
                      void updateRemoteAccess.mutateAsync({ id: selectedAgentId, dto });
                    }}
                  />
                ) : null}

                {selectedAgent?._raw ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
                      <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em]">
                        {t('agents.chromeProfilesTitle')}
                      </h4>
                      <button
                        type="button"
                        disabled={
                          !isAgentConnected(selectedAgentStatus) ||
                          syncChromeProfiles.isPending
                        }
                        onClick={() =>
                          void syncChromeProfiles.mutateAsync(selectedAgentId!)
                        }
                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 w-full sm:w-auto shrink-0"
                      >
                        <RotateCcw
                          size={12}
                          className={syncChromeProfiles.isPending ? 'animate-spin' : ''}
                        />
                        {t('agents.fetchChromeProfiles')}
                      </button>
                    </div>
                    <p className="text-[10px] text-on-surface-variant px-1">
                      {t('agents.chromeProfilesHint')}
                    </p>
                    {Array.isArray(chromeProfilesForDrawer) &&
                    chromeProfilesForDrawer.length > 0 ? (
                      <div className="bg-surface-container-high/50 rounded-2xl border border-white/5 divide-y divide-white/5">
                        {chromeProfilesForDrawer.map(
                          (p: { directory: string; name?: string }) => (
                            <div
                              key={p.directory}
                              className="px-3 sm:px-5 py-3 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3 text-sm min-w-0"
                            >
                              <span className="font-mono text-primary break-all">{p.directory}</span>
                              <span className="text-on-surface-variant sm:truncate sm:text-right">
                                {p.name ?? '—'}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-on-surface-variant/70 px-1 italic">
                        {isAgentConnected(selectedAgentStatus)
                          ? t('agents.chromeProfilesEmpty')
                          : t('agents.chromeProfilesOffline')}
                      </p>
                    )}
                    {syncChromeProfiles.isError ? (
                      <p className="text-[10px] text-error px-1">
                        {apiErrorMessage(syncChromeProfiles.error)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Secret Key */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-mono text-primary font-bold uppercase tracking-[0.2em] px-1">{t('agents.agentSecretKey')}</h4>
                  <div className="bg-surface-container-lowest border border-white/5 rounded-2xl p-5 space-y-3">
                    <p className="font-mono text-xs text-on-surface break-all">
                      {activeAgentKey ?? t('agents.regenerateHint')}
                    </p>
                    <div className="flex gap-2">
                      <CopyButton
                        text={activeAgentKey ?? ''}
                        disabled={!activeAgentKey}
                        iconSize={16}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold font-mono"
                        onError={() => setApiError(t('common.couldNotCopy'))}
                      />
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
                <div className="pt-6 sm:pt-10 mt-6 sm:mt-10 border-t border-white/5">
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
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                    className="relative w-full sm:max-w-md glass-card bg-surface rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 border border-error/20 shadow-[0_20px_50px_rgba(255,180,171,0.1)] max-h-[90dvh] overflow-y-auto"
                  >
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-error/10 flex items-center justify-center text-error mb-4 sm:mb-6">
                      <AlertCircle size={28} className="sm:hidden" />
                      <AlertCircle size={32} className="hidden sm:block" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">{t('agents.criticalAction')}</h3>
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
           <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
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
               className="relative w-full sm:max-w-2xl glass-card bg-surface rounded-t-[2rem] sm:rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] max-h-[92dvh] sm:max-h-[90vh] flex flex-col min-w-0"
             >
               <div className="absolute top-0 left-0 w-full h-1.5 bg-white/5 shrink-0">
                 <motion.div 
                   initial={{ width: '0%' }}
                   animate={{ width: `${(regStep / 3) * 100}%` }}
                   className="h-full bg-primary shadow-[0_0_15px_#a4e6ff]"
                 />
               </div>

               <div className="p-5 sm:p-8 lg:p-12 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                 <div className="flex justify-between items-start gap-3 mb-6 sm:mb-10">
                   <div className="min-w-0">
                     <span className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.3em]">{t('agents.step', { n: regStep })}</span>
                     <h3 className="text-xl sm:text-3xl font-bold text-on-surface mt-2">
                       {regStep === 1 ? t('agents.step1Title') : regStep === 2 ? t('agents.step2Title') : t('agents.step3Title')}
                     </h3>
                   </div>
                   <button 
                    type="button"
                    onClick={closeRegistration}
                    className="p-2.5 sm:p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all shrink-0"
                    aria-label={t('nav.closeSidebar')}
                   >
                     <Plus size={20} className="rotate-45" />
                   </button>
                 </div>

                 <div className="min-h-[200px] sm:min-h-[300px]">
                   {regStep === 1 && (
                     <motion.div 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       className="space-y-6 sm:space-y-8"
                     >
                       <div className="space-y-3">
                         <label className="text-sm sm:text-lg font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('agents.agentName')}</label>
                         <input 
                           type="text"
                           value={regData.name}
                           onChange={(e) => setRegData({...regData, name: e.target.value})}
                           placeholder={t('agents.agentNamePlaceholder')}
                           className="w-full bg-surface-container-highest border border-white/5 rounded-2xl p-4 sm:p-5 text-base sm:text-lg font-bold focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/20"
                         />
                         <p className="text-[10px] text-on-surface-variant/50 ml-1 italic">
                           {t('agents.agentNameHint')}
                         </p>
                       </div>
                       <div className="space-y-3">
                         <label className="text-sm sm:text-lg font-mono font-bold text-on-surface-variant uppercase tracking-widest ml-1">
                           {t('common.os')}
                         </label>
                         <select
                           value={regData.os}
                           onChange={(e) => setRegData({ ...regData, os: e.target.value })}
                           className="w-full bg-surface-container-highest border border-white/5 rounded-2xl p-4 sm:p-5 text-base sm:text-lg font-bold focus:outline-none focus:border-primary/40 transition-all appearance-none"
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
                       <div className="bg-primary/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-primary/10">
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
                            <CopyButton
                              text={regAgentKey ?? ''}
                              disabled={!regAgentKey}
                              iconSize={16}
                              className="text-primary font-bold font-mono text-xs hover:brightness-125 shrink-0"
                              onError={() => setApiError(t('common.couldNotCopy'))}
                            />
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

                       <div className="bg-surface-container-high/50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-white/5">
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

                 <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/5 flex flex-col sm:flex-row gap-3 sm:gap-4 shrink-0">
                   {regStep === 3 ? (
                     <button
                       type="button"
                       onClick={() => setRegStep(2)}
                       className="w-full sm:flex-1 py-4 sm:py-5 bg-white/5 border border-white/10 text-on-surface rounded-2xl font-bold hover:bg-white/10 transition-all"
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
                    className="w-full sm:flex-[2] py-4 sm:py-5 bg-primary text-on-primary rounded-2xl font-bold shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none"
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
