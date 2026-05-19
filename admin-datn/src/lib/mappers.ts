import type { LucideIcon } from 'lucide-react';
import { Laptop, Monitor, Terminal } from 'lucide-react';
import type {
  AdminStats,
  Agent,
  AgentStatus,
  AuditLogEntry,
  Task,
  User,
  Workflow,
} from '@/src/types/api';

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8).toUpperCase() : id.toUpperCase();
}

function formatRelativeTime(iso?: string): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return sec <= 5 ? 'Just now' : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

function pickAgentIcon(name: string, os?: string): LucideIcon {
  const n = (name + (os ?? '')).toLowerCase();
  if (n.includes('mac')) return Laptop;
  if (n.includes('linux') || n.includes('terminal')) return Terminal;
  return Monitor;
}

export function mapAgentStatusToUi(status: AgentStatus): 'ONLINE' | 'BUSY' | 'OFFLINE' | 'IDLE' {
  if (status === 'BUSY') return 'BUSY';
  if (status === 'ONLINE') return 'ONLINE';
  if (status === 'OFFLINE') return 'OFFLINE';
  return 'IDLE';
}

function parseAgentMetrics(agent: Agent) {
  const m = (agent.metadata ?? {}) as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const isOffline = agent.status === 'OFFLINE';
  const cpuPct = num(m.cpuPercent) ?? num(m.cpuUsage);
  const ramPct = num(m.ramPercent) ?? num(m.memoryPercent) ?? num(m.memoryUsage);
  const cpuCount = num(m.cpuCount);
  const totalMemory = num(m.totalMemory);
  const hasCpuPercent = cpuPct != null;

  /** Offline và không có % đã lưu → hiển thị số core từ metadata connect, không thanh 0%. */
  const cpuLabel = hasCpuPercent
    ? `${Math.round(cpuPct!)}%`
    : cpuCount != null
      ? `${cpuCount} cores`
      : '—';

  const ramUsed = num(m.ramUsedBytes);
  const ramTotal = num(m.ramTotalBytes);
  const ramLabelFromAgent =
    typeof m.ramLabel === 'string' && m.ramLabel.trim()
      ? normalizeRamLabel(m.ramLabel.trim())
      : null;

  const ramLabel =
    ramLabelFromAgent ??
    (ramPct != null
      ? `${Math.round(ramPct)}%`
      : ramUsed != null && ramTotal != null && ramTotal > 0
        ? formatRamRatio(ramUsed, ramTotal)
        : isOffline && totalMemory != null
          ? `${(totalMemory / 1024 ** 3).toFixed(1)} GB total`
          : totalMemory != null
            ? `${(totalMemory / 1024 ** 3).toFixed(1)} GB`
            : '—');

  const ramPercent =
    ramUsed != null && ramTotal != null && ramTotal > 0
      ? Math.min(100, Math.max(0, Math.round((ramUsed / ramTotal) * 100)))
      : ramPct != null
        ? Math.min(100, Math.max(0, Math.round(ramPct)))
        : 0;

  return {
    cpuPercent: hasCpuPercent
      ? Math.min(100, Math.max(0, Math.round(cpuPct!)))
      : 0,
    cpuLabel,
    /** Thanh % chỉ khi có cpuPercent (live hoặc snapshot đã lưu trong metadata). */
    showCpuBar: hasCpuPercent,
    ramPercent,
    ramLabel,
    /** Thanh RAM khi có used/total hoặc %; offline chỉ total → không bar. */
    showRamBar:
      (ramUsed != null && ramTotal != null && ramTotal > 0) || ramPct != null,
  };
}

function formatRamRatio(used: number, total: number): string {
  const fmt = (bytes: number) => (bytes / 1024 ** 3).toFixed(1);
  return `${fmt(used)}/${fmt(total)} GB`;
}

/** Chuẩn hóa `4/16 GB` → `4.0/16.0 GB`. */
export function normalizeRamLabel(label: string): string {
  const m = label.match(/^([\d.]+)\s*\/\s*([\d.]+)\s*GB$/i);
  if (!m) return label;
  const used = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(used) || !Number.isFinite(total)) return label;
  return `${used.toFixed(1)}/${total.toFixed(1)} GB`;
}

export interface AgentCardUi {
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
  icon: LucideIcon;
  _raw: Agent;
}

export function mapAgentToCard(agent: Agent, hasRunningTask = false): AgentCardUi {
  const uiStatus = mapAgentStatusToUi(agent.status);
  const seenAt = agent.lastSeenAt ?? agent.lastHeartbeatAt;
  const metrics = parseAgentMetrics(agent);
  const busy = hasRunningTask || agent.status === 'BUSY';

  return {
    name: agent.name,
    status: uiStatus,
    hostname: agent.hostname?.trim() || '—',
    os: agent.os?.trim() || '—',
    ip:
      agent.ip?.trim() ||
      (typeof (agent.metadata as Record<string, unknown> | undefined)?.ip === 'string'
        ? String((agent.metadata as Record<string, unknown>).ip).trim()
        : '') ||
      '—',
    activeTask: busy ? 'Yes' : 'No',
    ...metrics,
    lastSeen: formatRelativeTime(seenAt),
    icon: pickAgentIcon(agent.name, agent.os),
    _raw: agent,
  };
}

export interface DashboardMetricsUi {
  totalAgents: string;
  onlineAgents: string;
  runningTasks: string;
  failedTasks: string;
  workflows: string;
  agentsTrend?: number;
  failedTrend?: number;
}

export function mapStatsToMetrics(stats: AdminStats): DashboardMetricsUi {
  const { agents, tasks, workflows } = stats;
  const availability =
    agents.total > 0
      ? `${((agents.online / agents.total) * 100).toFixed(1)}% availability`
      : '—';
  return {
    totalAgents: String(agents.total),
    onlineAgents: String(agents.online),
    runningTasks: String(tasks.running),
    failedTasks: String(tasks.failed).padStart(2, '0'),
    workflows: String(workflows.total),
    agentsTrend: agents.total > 0 ? Math.round((agents.online / agents.total) * 100 - 80) : undefined,
    failedTrend: tasks.failed > 0 ? -5 : undefined,
    // subValue hints stored separately in view
    _availability: availability,
  } as DashboardMetricsUi & { _availability?: string };
}

export function mapTaskTrendToChart(
  trend: AdminStats['taskTrend'],
): Array<{ time: string; success: number; failure: number }> {
  return trend.map((d) => ({
    time: d.date.length > 5 ? d.date.slice(5) : d.date,
    success: d.completed,
    failure: d.failed,
  }));
}

export function isTaskTerminal(status: Task['status']): boolean {
  return (
    status === 'COMPLETED' ||
    status === 'FAILED' ||
    status === 'TIMEOUT' ||
    status === 'CANCELLED'
  );
}

export function formatTaskCommandPreview(command?: string, type?: Task['type']): string {
  if (!command?.trim()) return '—';

  const trimmed = command.trim();
  if (type === 'DESKTOP_AUTOMATION' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { steps?: unknown[] };
      if (Array.isArray(parsed.steps)) {
        return `Automation script · ${parsed.steps.length} step(s)`;
      }
    } catch {
      /* use truncated raw below */
    }
  }

  if (trimmed.length > 96) return `${trimmed.slice(0, 96)}…`;
  return trimmed;
}

export function mapTaskToListRow(task: Task): {
  id: string;
  shortId: string;
  type: string;
  status: Task['status'];
  command: string;
  commandFull: string;
  agentName: string;
  updatedAt: string;
  _raw: Task;
} {
  const commandFull = task.command ?? '—';
  return {
    id: task.id,
    shortId: shortId(task.id),
    type: task.type,
    status: task.status,
    command: formatTaskCommandPreview(commandFull, task.type),
    commandFull,
    agentName: task.agent?.name ?? shortId(task.agentId),
    updatedAt: formatRelativeTime(task.updatedAt ?? task.createdAt),
    _raw: task,
  };
}

export function mapTaskToEventLog(task: Task): {
  title: string;
  meta: string;
  variant: 'success' | 'error' | 'info';
} {
  const agentName = task.agent?.name ?? shortId(task.agentId);
  const isFail = task.status === 'FAILED' || task.status === 'TIMEOUT';
  const isOk = task.status === 'COMPLETED';
  return {
    title: isOk
      ? `Task ${shortId(task.id)} successful`
      : isFail
        ? `Task ${shortId(task.id)} failed`
        : `Task ${shortId(task.id)} ${task.status.toLowerCase()}`,
    meta: `${formatRelativeTime(task.updatedAt ?? task.createdAt)} • ${agentName}`,
    variant: isOk ? 'success' : isFail ? 'error' : 'info',
  };
}

export interface AutomationRowUi {
  id: string;
  title: string;
  status: 'Running' | 'Idle';
  lastRun: string;
  schedule: string;
  successRate: number;
  activeNodes: string[];
  _raw: Workflow;
}

export function mapWorkflowToAutomationRow(wf: Workflow): AutomationRowUi {
  return {
    id: wf.id,
    title: wf.name,
    status: wf.isActive ? 'Running' : 'Idle',
    lastRun: formatRelativeTime(wf.lastExecutedAt ?? wf.updatedAt),
    schedule: wf.cronExpression ?? 'MANUAL',
    successRate: wf.isActive ? 98 : 88,
    activeNodes: wf.isActive ? ['W1'] : ['—'],
    _raw: wf,
  };
}

export function mapAuditToLogRow(log: AuditLogEntry): {
  id: string;
  time: string;
  date: string;
  status: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  actor: string;
  target: string;
  category: string;
  payload?: string;
  detail?: string;
} {
  const d = new Date(log.createdAt);
  const action = log.action ?? '';
  let status: 'CRITICAL' | 'WARNING' | 'INFO' = 'INFO';
  if (action.includes('delete') || action.includes('revoke')) status = 'CRITICAL';
  else if (action.includes('fail') || action.includes('cancel')) status = 'WARNING';

  const category = action.startsWith('user.')
    ? 'Security'
    : action.startsWith('agent.')
      ? 'Security'
      : action.startsWith('task.')
        ? 'System'
        : 'System';

  return {
    id: log.id,
    time: d.toLocaleTimeString('en-GB', { hour12: false }),
    date: d.toISOString().slice(0, 10),
    status,
    title: action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    actor: log.actorEmail ?? log.actorId ?? 'SYSTEM',
    target: log.targetId ?? '—',
    category,
    payload: log.metadata ? JSON.stringify(log.metadata, null, 2) : undefined,
  };
}

export function mapUserToTableRow(user: User): {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Disabled';
  lastSession: string;
  avatar: string;
  _raw: User;
} {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    status: user.isActive ? 'Active' : 'Disabled',
    lastSession: formatRelativeTime(user.lastLoginAt ?? user.updatedAt),
    avatar: user.name.split(' ')[0] ?? user.email,
    _raw: user,
  };
}

export interface AgentHealthClusterUi {
  name: string;
  hostname: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'IDLE';
  cpu: string;
  ram: string;
  cpuPercent: number;
  ramPercent: number;
  showCpuBar: boolean;
  showRamBar: boolean;
}

export function mapAgentToHealthCluster(agent: Agent): AgentHealthClusterUi {
  const metrics = parseAgentMetrics(agent);
  return {
    name: agent.name,
    hostname: agent.hostname?.trim() || '—',
    status: mapAgentStatusToUi(agent.status),
    cpu: metrics.cpuLabel,
    ram: metrics.ramLabel,
    cpuPercent: metrics.cpuPercent,
    ramPercent: metrics.ramPercent,
    showCpuBar: metrics.showCpuBar,
    showRamBar: metrics.showRamBar,
  };
}
