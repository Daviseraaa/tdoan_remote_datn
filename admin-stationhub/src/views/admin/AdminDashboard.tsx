import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Cpu,
  GitBranch,
  CreditCard,
  Activity,
  RefreshCcw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import * as adminApi from '@/src/api/admin';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';
import { t } from '@/src/i18n/t';
import {
  filterTaskTrendByRange,
  TASK_TREND_RANGES,
  taskTrendRangeLabel,
  taskTrendToChartData,
  type TaskTrendRange,
} from '@/src/lib/taskTrend';

const TRIGGER_COLORS = ['#7c9cff', '#68f5b8', '#ffb86c', '#888888'];
const SUB_COLORS = ['#68f5b8', '#7c9cff', '#ff6b6b', '#888888'];

function formatVnd(n: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
      <Icon size={36} className="absolute right-3 top-3 opacity-[0.06]" />
      <p className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {sub ? <p className="text-xs text-on-surface-variant mt-1">{sub}</p> : null}
    </div>
  );
}

export default function AdminDashboard() {
  const [trendRange, setTrendRange] = useState<TaskTrendRange>('24H');
  const adminEnabled = useAdminQueryEnabled();

  const { data: stats, isLoading, refetch, isFetching } = useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: adminApi.getAdminStats,
    enabled: adminEnabled,
    refetchInterval: adminEnabled ? 30_000 : false,
  });

  const taskChart = useMemo(() => {
    if (!stats?.taskTrend) return [];
    const filtered = filterTaskTrendByRange(stats.taskTrend, trendRange);
    return taskTrendToChartData(filtered, trendRange);
  }, [stats?.taskTrend, trendRange]);

  const subPie = useMemo(() => {
    if (!stats?.subscriptions) return [];
    const s = stats.subscriptions;
    return [
      { name: t('billing.statusTrial'), value: s.trial },
      { name: t('billing.statusActive'), value: s.active },
      { name: t('billing.statusExpired'), value: s.expired },
      { name: 'Cancelled', value: s.cancelled },
    ].filter((x) => x.value > 0);
  }, [stats?.subscriptions]);

  const triggerBar = stats?.workflowRunsByTrigger ?? [];
  const paymentBar = stats?.paymentTrend ?? [];

  if (isLoading || !stats) {
    return <p className="text-on-surface-variant">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('adminPortal.dashboardTitle')}</h1>
          <p className="text-sm text-on-surface-variant mt-1">{t('adminPortal.dashboardSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm font-bold hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCcw size={16} className={isFetching ? 'animate-spin' : ''} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={t('adminPortal.statUsers')}
          value={stats.users.total}
          sub={`${stats.users.active} ${t('adminPortal.activeAccounts')}`}
        />
        <StatCard
          icon={Cpu}
          label={t('adminPortal.statAgents')}
          value={stats.agents.total}
          sub={`${stats.agents.online} online · ${stats.agents.busy} busy`}
        />
        <StatCard
          icon={GitBranch}
          label={t('adminPortal.statWorkflows')}
          value={stats.workflows.total}
          sub={`${stats.workflows.active} ${t('adminPortal.activeWorkflows')}`}
        />
        <StatCard
          icon={Activity}
          label={t('adminPortal.statRuns24h')}
          value={stats.workflowRunsLast24h}
          sub={`${stats.tasks.running} task đang chạy`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t('adminPortal.taskTrend')}</h3>
            <div className="flex gap-1">
              {TASK_TREND_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTrendRange(r)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    trendRange === r ? 'bg-primary text-on-primary' : 'bg-white/5'
                  }`}
                >
                  {taskTrendRangeLabel(r)}
                </button>
              ))}
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={taskChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#888" />
                <YAxis tick={{ fontSize: 10 }} stroke="#888" allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #ffffff20' }} />
                <Area type="monotone" dataKey="success" stackId="1" stroke="#68f5b8" fill="#68f5b840" />
                <Area type="monotone" dataKey="failure" stackId="1" stroke="#ff6b6b" fill="#ff6b6b40" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <h3 className="font-bold mb-4">{t('adminPortal.subscriptionMix')}</h3>
          <div className="h-56">
            {subPie.length === 0 ? (
              <p className="text-sm text-on-surface-variant">{t('adminPortal.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {subPie.map((_, i) => (
                      <Cell key={i} fill={SUB_COLORS[i % SUB_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <h3 className="font-bold mb-4">{t('adminPortal.runsByChannel')}</h3>
          <p className="text-xs text-on-surface-variant mb-3">{t('adminPortal.runsByChannelHint')}</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={triggerBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="triggerType" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#7c9cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-primary" />
            <h3 className="font-bold">{t('adminPortal.paymentTrend')}</h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentBar}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'amountVnd' ? formatVnd(Number(value)) : value
                  }
                />
                <Bar dataKey="count" fill="#7c9cff" name={t('adminPortal.paymentsCount')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
