import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Filter,
  X,
  ArrowRight,
  RotateCcw,
  Trash2,
  Terminal,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useTasksList, useTaskDetail, useTaskMutations } from '@/src/hooks/useTasks';
import { useAgentsList } from '@/src/hooks/useAgents';
import { isTaskTerminal, mapTaskToListRow } from '@/src/lib/mappers';
import { Pagination } from '@/src/components/Pagination';
import { apiErrorMessage } from '@/src/lib/api';

const TASK_PAGE_LIMIT = 20;
import type { TaskStatus, TaskType } from '@/src/types/api';

const TASK_TYPES: TaskType[] = [
  'COMMAND',
  'SCRIPT',
  'FILE_OPERATION',
  'SYSTEM_INFO',
  'OPEN_APP',
  'DESKTOP_AUTOMATION',
];

const TASK_STATUSES: TaskStatus[] = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
];

function statusStyle(status: TaskStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-tertiary/10 text-tertiary border-tertiary/20';
    case 'FAILED':
    case 'TIMEOUT':
      return 'bg-error/10 text-error border-error/20';
    case 'RUNNING':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'CANCELLED':
      return 'bg-white/5 text-on-surface-variant border-white/10';
    default:
      return 'bg-secondary-container/20 text-on-secondary-container border-white/10';
  }
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={16} />;
  if (status === 'FAILED' || status === 'TIMEOUT') return <AlertCircle size={16} />;
  if (status === 'RUNNING') return <Loader2 size={16} className="animate-spin" />;
  return <Clock size={16} />;
}

export default function Tasks() {
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const listParams = useMemo(
    () => ({
      page,
      limit: TASK_PAGE_LIMIT,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    }),
    [page, statusFilter, typeFilter],
  );

  const { data, isLoading } = useTasksList(listParams);
  const { data: detail } = useTaskDetail(selectedId);
  const { create, cancel, retry } = useTaskMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });

  const tasks = (data?.items ?? []).map(mapTaskToListRow);
  const selected = selectedId ? detail ?? tasks.find((t) => t.id === selectedId)?._raw : null;

  const [form, setForm] = useState({
    type: 'COMMAND' as TaskType,
    agentId: '',
    command: '',
    timeout: 60000,
    priority: 5,
  });

  const handleCreate = async () => {
    setError('');
    if (!form.agentId || !form.command.trim()) {
      setError('Agent and command are required.');
      return;
    }
    try {
      await create.mutateAsync({
        type: form.type,
        agentId: form.agentId,
        command: form.command,
        timeout: form.timeout,
        priority: form.priority,
      });
      setShowCreate(false);
      setForm({ type: 'COMMAND', agentId: '', command: '', timeout: 60000, priority: 5 });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancel.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retry.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="pb-20 min-w-0 max-w-full overflow-x-hidden">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">Tasks</h2>
          <p className="text-on-surface-variant text-body-md mt-2 max-w-2xl">
            Dispatch commands and automations to agents.
          </p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2.5 px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold">
          <Plus size={20} /> New Task
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} /><span>{error}</span>
          <button type="button" onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      <div className="glass-card rounded-3xl p-6 mb-8 border border-white/5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "")} className="bg-surface-container-highest border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold min-w-[160px]">
              <option value="">All statuses</option>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TaskType | "")} className="bg-surface-container-highest border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold min-w-[200px]">
              <option value="">All types</option>
              {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <p className="text-[10px] font-mono text-on-surface-variant ml-auto">{data?.meta.total ?? tasks.length} tasks</p>
        </div>
      </div>

      <div className="space-y-3 min-w-0 max-w-full overflow-hidden">
        {isLoading && <p className="text-on-surface-variant px-2">Loading tasks…</p>}
        {!isLoading && tasks.length === 0 && <p className="text-on-surface-variant px-2">No tasks found.</p>}
        {tasks.map((task, i) => (
          <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="min-w-0 max-w-full">
            <button type="button" onClick={() => setSelectedId(task.id)} className="w-full max-w-full min-w-0 overflow-hidden text-left glass-card rounded-2xl p-5 flex items-center gap-6 hover:border-primary/30 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary">
                <Terminal size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-on-surface group-hover:text-primary truncate">{task.shortId}</h3>
                  <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border flex items-center gap-1', statusStyle(task.status))}>
                    <StatusIcon status={task.status} /> {task.status}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant px-2 py-0.5 bg-white/5 rounded">{task.type}</span>
                </div>
                <p className="text-sm text-on-surface-variant mt-1 font-mono line-clamp-2 break-all overflow-hidden" title={task.commandFull}>
                  {task.command}
                </p>
                <p className="text-[10px] text-on-surface-variant/60 mt-1">{task.agentName} · {task.updatedAt}</p>
              </div>
              <ArrowRight className="text-on-surface-variant opacity-0 group-hover:opacity-100 shrink-0" size={18} />
            </button>
          </motion.div>
        ))}
      </div>

      <Pagination
        page={page}
        limit={TASK_PAGE_LIMIT}
        total={data?.meta.total ?? 0}
        onPageChange={setPage}
        className="mt-6"
      />

      <AnimatePresence>
        {selectedId && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setSelectedId(null)} />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed top-0 right-0 h-full w-[480px] bg-surface border-l border-white/10 z-[70] flex flex-col shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">Task {selected.id.slice(0, 8)}</h3>
                  <span className={cn('inline-flex mt-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase border', statusStyle(selected.status))}>{selected.status}</span>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="p-2 hover:bg-white/5 rounded-full"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                <div><p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase mb-1">Type</p><p className="font-bold">{selected.type}</p></div>
                <div><p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase mb-1">Agent</p><p className="font-bold">{selected.agent?.name ?? selected.agentId}</p></div>
                <div><p className="text-[10px] font-mono font-bold text-on-surface-variant uppercase mb-1">Command</p><pre className="text-xs font-mono bg-surface-container-low p-4 rounded-xl border border-white/5 max-w-full overflow-x-auto whitespace-pre-wrap break-all">{selected.command ?? "—"}</pre></div>
                {selected.result && (
                  <div><p className="text-[10px] font-mono font-bold text-tertiary uppercase mb-1">Result</p><pre className="text-xs font-mono bg-tertiary/5 p-4 rounded-xl border border-tertiary/20 max-w-full overflow-x-auto whitespace-pre-wrap break-all">{selected.result}</pre></div>
                )}
                {selected.error && (
                  <div><p className="text-[10px] font-mono font-bold text-error uppercase mb-1">Error</p><pre className="text-xs font-mono bg-error/5 p-4 rounded-xl border border-error/20 max-w-full overflow-x-auto whitespace-pre-wrap break-all">{selected.error}</pre></div>
                )}
              </div>
              <div className="p-8 border-t border-white/5 flex gap-3">
                {isTaskTerminal(selected.status) ? (
                  <button type="button" onClick={() => void handleRetry(selected.id)} className="flex-1 py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2"><RotateCcw size={18} /> Retry</button>
                ) : (
                  <button type="button" onClick={() => void handleCancel(selected.id)} className="flex-1 py-4 bg-error/20 text-error border border-error/30 rounded-xl font-bold flex items-center justify-center gap-2"><Trash2 size={18} /> Cancel</button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-lg glass-card rounded-3xl p-8 border border-white/10">
              <h3 className="text-2xl font-bold mb-6">Create Task</h3>
              <div className="space-y-4">
                <div><label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Agent</label>
                <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10">
                  <option value="">Select agent…</option>
                  {(agentsPage?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.status})</option>)}
                </select></div>
                <div><label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Type</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })} className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10">
                  {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select></div>
                <div><label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Command</label>
                <textarea value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} rows={3} className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Timeout (ms)</label>
                  <input type="number" min={5000} value={form.timeout} onChange={(e) => setForm({ ...form, timeout: Number(e.target.value) })} className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10" /></div>
                  <div><label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">Priority</label>
                  <input type="number" min={0} max={10} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10" /></div>
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-3 rounded-xl border border-white/10 font-bold">Cancel</button>
                <button type="button" onClick={() => void handleCreate()} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold">Dispatch</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
