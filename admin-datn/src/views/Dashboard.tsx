import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Filter,
  RefreshCcw,
  User,
  Users,
  Cpu,
  Database,
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { useDashboard } from '@/src/hooks/useDashboard';
import {
  mapAgentToHealthCluster,
  mapStatsToMetrics,
  mapTaskToEventLog,
  type AgentHealthClusterUi,
} from '@/src/lib/mappers';
import {
  filterTaskTrendByRange,
  TASK_TREND_RANGES,
  taskTrendRangeLabel,
  taskTrendToChartData,
  type TaskTrendRange,
} from '@/src/lib/taskTrend';
import {
  agentsPageSearchParams,
  clusterFilterLabel,
  filterAgentsByCluster,
  filterAgentsByStatus,
  nextClusterFilter,
  nextStatusFilter,
  statusFilterLabel,
  type AgentClusterFilter,
  type AgentStatusFilter,
} from '@/src/lib/agentFilters';
import type { Agent } from '@/src/types/api';

const HEALTH_PREVIEW_LIMIT = 8;

const MetricCard = ({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  colorClass = 'text-primary',
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: number;
  icon?: React.ComponentType<{ size?: number }>;
  colorClass?: string;
}) => (
  <motion.div className="glass-card p-5 rounded-2xl flex flex-col gap-2 group hover:border-primary/40 transition-all duration-300">
    <div className="flex justify-between items-start">
      <span className="text-on-surface-variant text-[11px] font-bold uppercase tracking-wider">
        {label}
      </span>
      {trend != null ? (
        <div
          className={cn(
            'flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-full',
            trend > 0 ? 'text-tertiary bg-tertiary/10' : 'text-error bg-error/10',
          )}
        >
          {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend > 0 ? '+' : ''}
          {trend}%
        </div>
      ) : Icon ? (
        <Icon size={16} className="text-on-surface-variant group-hover:text-primary transition-colors" />
      ) : null}
    </div>
    <motion.div className={cn('text-3xl font-bold tracking-tight mt-1', colorClass)}>{value}</motion.div>
    {subValue ? (
      <p className="text-[10px] text-on-surface-variant font-mono opacity-60 mt-1 uppercase tracking-tighter">
        {subValue}
      </p>
    ) : null}
  </motion.div>
);

function healthStatusStyles(status: AgentHealthClusterUi['status']) {
  switch (status) {
    case 'ONLINE':
      return {
        dot: 'bg-tertiary pulse-primary',
        badge: 'bg-tertiary/10 text-tertiary',
      };
    case 'BUSY':
      return {
        dot: 'bg-primary animate-pulse shadow-[0_0_8px_#a4e6ff]',
        badge: 'bg-primary/10 text-primary',
      };
    case 'OFFLINE':
      return {
        dot: 'bg-on-surface-variant/40',
        badge: 'bg-white/5 text-on-surface-variant border border-white/10',
      };
    default:
      return {
        dot: 'bg-secondary',
        badge: 'bg-secondary-container/20 text-on-secondary-container',
      };
  }
}

const HealthClusterCard = ({
  name,
  hostname,
  status,
  cpu,
  ram,
  cpuPercent,
  ramPercent,
  showCpuBar,
  showRamBar,
}: AgentHealthClusterUi) => {
  const st = healthStatusStyles(status);
  return (
    <motion.div
      layout
      className="bg-surface-container-low/50 border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/40 transition-all group min-w-0"
    >
      <div className="flex justify-between items-start gap-2 text-[10px] font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', st.dot)} />
          <div className="min-w-0">
            <span className="text-on-surface font-bold block truncate">{name}</span>
            <span className="text-on-surface-variant/60 truncate block">{hostname}</span>
          </div>
        </div>
        <span className={cn('px-1.5 py-0.5 rounded font-bold uppercase tracking-tight shrink-0', st.badge)}>
          {status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1 opacity-60">
            <Cpu size={10} className="text-primary" />
            <p className="text-[9px] font-mono text-on-surface-variant uppercase">CPU</p>
          </div>
          <p className="text-sm font-bold text-on-surface font-mono">{cpu}</p>
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
        </div>
        <motion.div className="space-y-1">
          <div className="flex items-center gap-1 opacity-60">
            <Database size={10} className="text-tertiary" />
            <p className="text-[9px] font-mono text-on-surface-variant uppercase">RAM</p>
          </div>
          <p className="text-sm font-bold text-on-surface font-mono">{ram}</p>
          {showRamBar ? (
            <motion.div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-tertiary rounded-full transition-all duration-500"
                style={{ width: `${ramPercent}%` }}
              />
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const dash = useDashboard();
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>('all');
  const [clusterFilter, setClusterFilter] = useState<AgentClusterFilter>('all');
  const [taskTrendRange, setTaskTrendRange] = useState<TaskTrendRange>('24H');

  const metrics = useMemo(() => {
    if (dash.mode === 'admin' && dash.stats.data) {
      return mapStatsToMetrics(dash.stats.data);
    }
    if (dash.mode !== 'user') {
      return {
        totalAgents: '0',
        onlineAgents: '—',
        runningTasks: '0',
        failedTasks: '00',
        workflows: '0',
      };
    }
    const agentsTotal = dash.agentsCount?.data?.meta.total ?? 0;
    const wfTotal = dash.workflowsCount?.data?.meta.total ?? 0;
    return {
      totalAgents: String(agentsTotal),
      onlineAgents: '—',
      runningTasks: String(
        dash.recentTasks?.data?.items.filter((t) => t.status === 'RUNNING').length ?? 0,
      ),
      failedTasks: String(
        dash.recentTasks?.data?.items.filter((t) => t.status === 'FAILED').length ?? 0,
      ).padStart(2, '0'),
      workflows: String(wfTotal),
    };
  }, [dash]);

  const chartData = useMemo(() => {
    if (dash.mode === 'admin' && dash.stats.data?.taskTrend?.length) {
      const filtered = filterTaskTrendByRange(dash.stats.data.taskTrend, taskTrendRange);
      return taskTrendToChartData(filtered, taskTrendRange);
    }
    return [{ time: '—', success: 0, failure: 0 }];
  }, [dash, taskTrendRange]);

  const recentTasks =
    dash.mode === 'admin'
      ? (dash.recentTasks.data?.items ?? [])
      : (dash.recentTasks.data?.items ?? []);

  const allHealthAgents: Agent[] =
    dash.mode === 'admin'
      ? (dash.healthAgents.data?.items ?? [])
      : (dash.agentsPreview?.data?.items ?? []);

  const filteredHealthAgents = useMemo(() => {
    let list = filterAgentsByStatus(allHealthAgents, statusFilter);
    list = filterAgentsByCluster(list, clusterFilter);
    return list;
  }, [allHealthAgents, statusFilter, clusterFilter]);

  const healthPreview = filteredHealthAgents.slice(0, HEALTH_PREVIEW_LIMIT);

  const healthCounts = useMemo(() => {
    const online = filteredHealthAgents.filter(
      (a) => a.status === 'ONLINE' || a.status === 'BUSY',
    ).length;
    return { online, offline: filteredHealthAgents.length - online };
  }, [filteredHealthAgents]);

  const eventLogs = recentTasks.slice(0, 4).map((t) => {
    const mapped = mapTaskToEventLog(t);
    const icon =
      mapped.variant === 'success'
        ? CheckCircle2
        : mapped.variant === 'error'
          ? AlertCircle
          : RefreshCcw;
    const color =
      mapped.variant === 'success'
        ? 'text-tertiary'
        : mapped.variant === 'error'
          ? 'text-error'
          : 'text-primary';
    return { icon, color, title: mapped.title, meta: mapped.meta };
  });

  const agentTotal =
    dash.mode === 'admin'
      ? (dash.stats.data?.agents.total ?? 0)
      : (dash.agentsCount?.data?.meta.total ?? 0);

  const availability =
    dash.mode === 'admin' && dash.stats.data
      ? t('dashboard.availability', {
          n:
            dash.stats.data.agents.total > 0
              ? ((dash.stats.data.agents.online / dash.stats.data.agents.total) * 100).toFixed(1)
              : 0,
        })
      : undefined;

  const agentsFleetHref = `/agents${agentsPageSearchParams(statusFilter, clusterFilter)}`;

  return (
    <motion.div className="space-y-8 pb-12">
      <motion.div>
        <h2 className="text-4xl font-bold tracking-tight text-on-surface">{t('dashboard.title')}</h2>
        <p className="text-on-surface-variant text-body-md mt-1">
          {agentTotal === 1
            ? t('dashboard.subtitle', { count: 1 })
            : t('dashboard.subtitle', { count: agentTotal })}
        </p>
      </motion.div>

      <section className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard
          label={t('dashboard.totalAgents')}
          value={metrics.totalAgents}
          trend={metrics.agentsTrend}
          subValue={t('dashboard.fleetTotal')}
        />
        <MetricCard
          label={t('dashboard.onlineAgents')}
          value={
            dash.mode === 'admin' ? String(dash.stats.data?.agents.online ?? t('common.emDash')) : metrics.onlineAgents
          }
          subValue={availability ?? t('dashboard.tenantScope')}
          colorClass="text-on-surface"
        />
        <MetricCard
          label={t('dashboard.runningTasks')}
          value={metrics.runningTasks}
          subValue={t('dashboard.activeNow')}
          colorClass="text-secondary"
          icon={Activity}
        />
        <MetricCard
          label={t('dashboard.failedTasks')}
          value={metrics.failedTasks}
          trend={metrics.failedTrend}
          subValue={t('dashboard.last24h')}
          colorClass="text-error"
        />
        <MetricCard
          label={t('dashboard.workflows')}
          value={metrics.workflows}
          subValue={
            dash.mode === 'admin'
              ? t('dashboard.workflowsActiveSub', { n: dash.stats.data?.workflows.active ?? 0 })
              : t('dashboard.total')
          }
          colorClass="text-tertiary"
        />
      </section>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 glass-card rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold text-on-surface">{t('dashboard.taskAnalytics')}</h3>
              <p className="text-xs text-on-surface-variant">
                {dash.mode === 'admin'
                  ? `${taskTrendRangeLabel(taskTrendRange)} · ${t('time.filteredFrom7Day')}`
                  : t('dashboard.adminOnlyChart')}
              </p>
            </div>
            <div className="flex p-1 bg-surface-container-high rounded-xl gap-1">
              {TASK_TREND_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTaskTrendRange(range)}
                  disabled={dash.mode !== 'admin'}
                  className={cn(
                    'px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all',
                    range === taskTrendRange
                      ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                      : 'text-on-surface-variant hover:text-on-surface',
                    dash.mode !== 'admin' && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a4e6ff" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a4e6ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#bbc9cf', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171f33',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="success"
                  stroke="#a4e6ff"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorSuccess)"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="failure"
                  stroke="#ffb4ab"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4 glass-card rounded-2xl p-6 flex flex-col">
          <motion.div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-on-surface">{t('dashboard.eventLog')}</h3>
            <button type="button" className="text-on-surface-variant hover:text-primary transition-colors">
              <Filter size={18} />
            </button>
          </motion.div>
          <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar">
            {(eventLogs.length
              ? eventLogs
              : [{ icon: User, color: 'text-on-surface-variant', title: t('dashboard.noRecentEvents'), meta: t('common.emDash') }]
            ).map((log, i) => (
              <div key={i} className="flex gap-4 group cursor-default">
                <div className="flex flex-col items-center">
                  <motion.div
                    className={cn(
                      'w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 transition-all group-hover:scale-110',
                      log.color,
                    )}
                  >
                    <log.icon size={16} />
                  </motion.div>
                  {i < 3 && <div className="w-px h-full bg-white/5 mt-2" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm font-semibold text-on-surface truncate">{log.title}</p>
                  <p className="text-[10px] font-mono text-on-surface-variant opacity-60 mt-0.5">{log.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="glass-card rounded-2xl p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-on-surface">{t('dashboard.agentHealth')}</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {filteredHealthAgents.length === 0
                ? t('dashboard.noAgentsMatch')
                : t('dashboard.showingSummary', {
                    preview: healthPreview.length,
                    total: filteredHealthAgents.length,
                    online: healthCounts.online,
                    offline: healthCounts.offline,
                  })}
              {statusFilter !== 'all' || clusterFilter !== 'all'
                ? ` · ${t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })} · ${t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter((s) => nextStatusFilter(s))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs font-bold tracking-tight"
            >
              <Filter size={14} className="text-on-surface-variant" />
              {t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })}
            </button>
            <button
              type="button"
              onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs font-bold tracking-tight"
            >
              <Users size={14} className="text-on-surface-variant" />
              {t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}
            </button>
            <Link
              to={agentsFleetHref}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold text-xs uppercase tracking-wider hover:bg-primary/20 transition-all group"
            >
              {t('dashboard.viewAllAgents')}
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(dash.mode === 'admin' ? dash.healthAgents.isLoading : dash.agentsPreview?.isLoading) ? (
            <p className="text-on-surface-variant text-sm col-span-full">{t('dashboard.loadingAgents')}</p>
          ) : healthPreview.length === 0 ? (
            <p className="text-on-surface-variant text-sm col-span-full">
              {allHealthAgents.length === 0
                ? t('dashboard.noAgentsRegistered')
                : t('agents.noMatch')}
            </p>
          ) : (
            healthPreview.map((agent) => (
              <HealthClusterCard key={agent.id} {...mapAgentToHealthCluster(agent)} />
            ))
          )}
        </div>
        {filteredHealthAgents.length > HEALTH_PREVIEW_LIMIT ? (
          <p className="text-center text-[11px] text-on-surface-variant mt-4 font-mono">
            {t('dashboard.moreAgents', {
              n: filteredHealthAgents.length - HEALTH_PREVIEW_LIMIT,
            })}{' '}
            <Link to={agentsFleetHref} className="text-primary hover:underline">
              {t('nav.agents')}
            </Link>
          </p>
        ) : null}
      </section>
    </motion.div>
  );
}
