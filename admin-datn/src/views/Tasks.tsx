import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  ArrowRight,
  RotateCcw,
  Trash2,
  Terminal,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Play,
  Pencil,
  Copy,
  Filter,
  Layers,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { useTasksList, useTaskDetail, useTaskMutations } from '@/src/hooks/useTasks';
import { useTaskTemplatesList, useTaskTemplateMutations } from '@/src/hooks/useTaskTemplates';
import { useAgentsList } from '@/src/hooks/useAgents';
import { isTaskTerminal, mapTaskToListRow } from '@/src/lib/mappers';
import {
  dedupeTaskLogs,
  formatTaskDateTime,
  formatTaskDurationMs,
} from '@/src/lib/taskDetailFormat';
import { Pagination } from '@/src/components/Pagination';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { TaskStatus, TaskType } from '@/src/types/api';
import { useAuth } from '@/src/hooks/useAuth';

const TASK_PAGE_LIMIT = 20;

type TaskTab = 'templates' | 'history';

const TASK_TYPES: TaskType[] = [
  'COMMAND',
  'SCRIPT',
  'FILE_OPERATION',
  'SYSTEM_INFO',
  'OPEN_APP',
  'OPEN_BROWSER',
  'CHROME_EXTENSION',
  'DESKTOP_AUTOMATION',
];

const TASK_STATUSES: TaskStatus[] = [
  'PENDING',
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'TIMEOUT',
  'CANCELLED',
];

function TaskDetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,140px)_1fr] gap-1 sm:gap-3 py-2.5 px-3 border-b border-white/5 text-sm last:border-b-0">
      <span className="text-on-surface-variant font-mono text-[10px] uppercase tracking-wide shrink-0">
        {label}
      </span>
      <div className="text-on-surface break-all min-w-0">{children}</div>
    </div>
  );
}

function logDotClass(level: string) {
  if (level === 'ERROR') return 'bg-error';
  if (level === 'WARN') return 'bg-amber-400';
  return 'bg-primary';
}

function statusStyle(status: TaskStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-tertiary/10 text-tertiary border-tertiary/20';
    case 'FAILED':
    case 'TIMEOUT':
      return 'bg-error/10 text-error border-error/20';
    case 'RUNNING':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'QUEUED':
      return 'bg-secondary-container/30 text-secondary-container border-white/10';
    case 'CANCELLED':
      return 'bg-white/5 text-on-surface-variant border-white/10';
    default:
      return 'bg-secondary-container/20 text-on-secondary-container border-white/10';
  }
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={16} />;
  if (status === 'FAILED' || status === 'TIMEOUT') return <AlertCircle size={16} />;
  if (status === 'RUNNING' || status === 'QUEUED') return <Loader2 size={16} className="animate-spin" />;
  return <Clock size={16} />;
}

function taskStatusFilterLabel(status: TaskStatus | ''): string {
  return status ? t(`status.${status}` as 'status.PENDING') : t('common.all');
}

function taskTypeFilterLabel(type: TaskType | ''): string {
  return type ? t(`taskType.${type}` as 'taskType.COMMAND') : t('common.all');
}

const FILTER_BTN =
  'flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold tracking-tight';

function TaskFilterMenu({
  open,
  onOpenChange,
  buttonLabel,
  icon,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buttonLabel: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePanelPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.max(220, r.width);
    let left = r.right - width;
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const top = r.bottom + margin;
    const maxH = Math.max(120, window.innerHeight - top - margin);
    setPanelStyle({ top, left, width, maxHeight: Math.min(288, maxH) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, buttonLabel, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePanelPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={panelStyle}
        className="fixed z-[1000] overflow-y-auto py-2 rounded-xl border border-white/10 bg-surface-container-high shadow-xl custom-scrollbar"
      >
        {children}
      </div>,
      document.body,
    );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(FILTER_BTN, open && 'bg-white/5 border-white/20')}
      >
        {icon}
        {buttonLabel}
      </button>
      {panel}
    </div>
  );
}

function TaskFilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-2.5 text-sm font-bold hover:bg-white/5 transition-colors',
        active ? 'text-primary bg-primary/10' : 'text-on-surface',
      )}
    >
      {children}
    </button>
  );
}

export default function Tasks() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<TaskTab>('templates');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const { data: detail, isLoading: detailLoading } = useTaskDetail(selectedId);
  const { cancel, retry } = useTaskMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const { data: templatesPage, isLoading: templatesLoading } = useTaskTemplatesList({
    page: 1,
    limit: 100,
  });
  const { remove: removeTpl, run: runTpl } = useTaskTemplateMutations();

  const tasks = (data?.items ?? []).map(mapTaskToListRow);
  const selected = selectedId ? detail ?? tasks.find((x) => x.id === selectedId)?._raw : null;
  const selectedTaskLogs = selected ? dedupeTaskLogs(selected.logs) : [];
  const templates = templatesPage?.items ?? [];

  const copyCommandToClipboard = async (text: string | null | undefined) => {
    const s = (text ?? '').trim();
    if (!s) return;
    setError('');
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      setError(t('common.couldNotCopy'));
    }
  };

  const activeAgentName = (agentId: string) =>
    agentsPage?.items.find((a) => a.id === agentId)?.name ?? agentId;

  const handleRunTemplate = async (id: string) => {
    setError('');
    try {
      await runTpl.mutateAsync(id);
      setTab('history');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setError('');
    try {
      await removeTpl.mutateAsync(id);
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
    <div className="pb-20 min-w-0 max-w-full overflow-x-clip">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">{t('tasks.title')}</h2>
          <p className="text-on-surface-variant text-body-md mt-2 max-w-2xl">
            {t('tasks.subtitle')}
          </p>
        </div>
        {tab === 'templates' ? (
          <button
            type="button"
            onClick={() => navigate('/tasks/templates/new')}
            className="flex items-center gap-2.5 px-8 py-4 bg-primary text-on-primary rounded-2xl font-bold"
          >
            <Plus size={20} /> {t('tasks.newTemplate')}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="glass-card rounded-2xl p-2 border border-white/5 inline-flex gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('templates');
              setStatusMenuOpen(false);
              setTypeMenuOpen(false);
            }}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all',
              tab === 'templates' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t('tasks.templatesTab')}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-bold transition-all',
              tab === 'history' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {t('tasks.historyTab')}
          </button>
        </div>

        {tab === 'history' ? (
          <div className="flex flex-wrap items-center gap-3">
            <TaskFilterMenu
              open={statusMenuOpen}
              onOpenChange={(open) => {
                setStatusMenuOpen(open);
                if (open) setTypeMenuOpen(false);
              }}
              buttonLabel={t('filters.statusLabel', { value: taskStatusFilterLabel(statusFilter) })}
              icon={<Filter size={16} className="text-on-surface-variant shrink-0" />}
            >
              <TaskFilterOption
                active={!statusFilter}
                onClick={() => {
                  setStatusFilter('');
                  setStatusMenuOpen(false);
                }}
              >
                {t('common.all')}
              </TaskFilterOption>
              {TASK_STATUSES.map((s) => (
                <TaskFilterOption
                  key={s}
                  active={statusFilter === s}
                  onClick={() => {
                    setStatusFilter(s);
                    setStatusMenuOpen(false);
                  }}
                >
                  {t(`status.${s}` as 'status.PENDING')}
                </TaskFilterOption>
              ))}
            </TaskFilterMenu>

            <TaskFilterMenu
              open={typeMenuOpen}
              onOpenChange={(open) => {
                setTypeMenuOpen(open);
                if (open) setStatusMenuOpen(false);
              }}
              buttonLabel={t('filters.typeLabel', { value: taskTypeFilterLabel(typeFilter) })}
              icon={<Layers size={16} className="text-on-surface-variant shrink-0" />}
            >
              <TaskFilterOption
                active={!typeFilter}
                onClick={() => {
                  setTypeFilter('');
                  setTypeMenuOpen(false);
                }}
              >
                {t('common.all')}
              </TaskFilterOption>
              {TASK_TYPES.map((taskType) => (
                <TaskFilterOption
                  key={taskType}
                  active={typeFilter === taskType}
                  onClick={() => {
                    setTypeFilter(taskType);
                    setTypeMenuOpen(false);
                  }}
                >
                  {t(`taskType.${taskType}` as 'taskType.COMMAND')}
                </TaskFilterOption>
              ))}
            </TaskFilterMenu>

            <p className="text-[10px] font-mono text-on-surface-variant">
              {t('tasks.count', { n: data?.meta.total ?? tasks.length })}
            </p>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} /><span>{error}</span>
          <button type="button" onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {tab === 'history' ? (
        <>
          <div className="space-y-3 min-w-0 max-w-full overflow-x-clip">
            {isLoading && <p className="text-on-surface-variant px-2">{t('tasks.loading')}</p>}
            {!isLoading && tasks.length === 0 && <p className="text-on-surface-variant px-2">{t('tasks.empty')}</p>}
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
                        <StatusIcon status={task.status} /> {t(`status.${task.status}` as 'status.PENDING')}
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
        </>
      ) : (
        <div className="space-y-3 min-w-0 max-w-full overflow-x-clip">
          {templatesLoading && <p className="text-on-surface-variant px-2">{t('tasks.templatesLoading')}</p>}
          {!templatesLoading && templates.length === 0 ? (
            <p className="text-on-surface-variant px-2">{t('tasks.templatesEmpty')}</p>
          ) : null}
          {!templatesLoading && templates.map((tpl, i) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass-card rounded-2xl p-5 border border-white/5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-on-surface truncate">{tpl.name}</p>
                  {isAdmin && tpl.user ? (
                    <p className="text-[10px] font-mono text-on-surface-variant mt-1">
                      {t('tasks.templateOwner', { name: tpl.user.name, email: tpl.user.email })}
                    </p>
                  ) : null}
                  <p className="text-[10px] font-mono text-on-surface-variant mt-1">
                    {tpl.agent?.name ?? activeAgentName(tpl.agentId)} · {t(`taskType.${tpl.type}` as 'taskType.COMMAND')}
                  </p>
                  <p className="text-sm text-on-surface-variant mt-2 font-mono line-clamp-2 break-all">
                    {tpl.command}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => void handleRunTemplate(tpl.id)}
                    disabled={runTpl.isPending}
                    className="px-3 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    <Play size={14} /> {t('tasks.runTemplate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/tasks/templates/${tpl.id}/edit`)}
                    className="px-3 py-2 rounded-xl border border-white/10 text-on-surface-variant hover:text-on-surface text-xs font-bold flex items-center gap-1"
                  >
                    <Pencil size={14} /> {t('common.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(tpl.id)}
                    disabled={removeTpl.isPending}
                    className="px-3 py-2 rounded-xl border border-error/30 text-error text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {t('common.delete')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedId && selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => setSelectedId(null)} />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-[720px] bg-surface border-l border-white/10 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-2xl font-bold">{t('tasks.detailTitle', { id: selected.id.slice(0, 8) })}</h3>
                  <span
                    className={cn(
                      'inline-flex mt-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase border items-center gap-1',
                      statusStyle(selected.status),
                    )}
                  >
                    <StatusIcon status={selected.status} />
                    {t(`status.${selected.status}` as 'status.PENDING')}
                  </span>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="p-2 hover:bg-white/5 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar min-h-0">
                {detailLoading && !detail ? (
                  <div className="flex justify-center py-12 text-on-surface-variant">
                    <Loader2 className="animate-spin w-8 h-8" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    'rounded-xl border border-white/10 overflow-hidden bg-surface-container-low/20',
                    detailLoading && !detail ? 'opacity-50 pointer-events-none' : '',
                  )}
                >
                  <TaskDetailRow label={t('tasks.detailId')}>
                    <span className="font-mono text-xs">{selected.id}</span>
                  </TaskDetailRow>
                  <TaskDetailRow label={t('common.type')}>
                    <span className="font-mono font-bold">{selected.type}</span>
                  </TaskDetailRow>
                  <TaskDetailRow label={t('common.status')}>
                    <span className={cn('inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border', statusStyle(selected.status))}>
                      {t(`status.${selected.status}` as 'status.PENDING')}
                    </span>
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.command')}>
                    <div className="space-y-2">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={!(selected.command ?? '').trim()}
                          onClick={() => void copyCommandToClipboard(selected.command)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold uppercase text-on-surface-variant disabled:opacity-30 disabled:pointer-events-none"
                          title={t('tasks.copyCommand')}
                        >
                          <Copy size={14} />
                          {t('common.copy')}
                        </button>
                      </div>
                      <pre className="text-xs font-mono bg-surface-container-low p-3 rounded-lg border border-white/5 whitespace-pre-wrap break-all">
                        {selected.command ?? '—'}
                      </pre>
                    </div>
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.detailExitCode')}>
                    {selected.exitCode != null ? String(selected.exitCode) : '—'}
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.agent')}>
                    {selected.agent?.name ?? selected.agentId}
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.detailTimeout')}>
                    {formatTaskDurationMs(selected.timeout ?? undefined)}
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.detailStarted')}>
                    {formatTaskDateTime(selected.startedAt)}
                  </TaskDetailRow>
                  <TaskDetailRow label={t('tasks.detailCompleted')}>
                    {formatTaskDateTime(selected.completedAt)}
                  </TaskDetailRow>
                </div>

                <h4 className="text-sm font-bold text-on-surface mt-8 mb-3">{t('tasks.detailResultTitle')}</h4>
                <pre className="text-xs font-mono bg-[#0b0f14] text-[#d4d4d4] p-3 rounded-lg border border-white/10 max-h-80 overflow-auto whitespace-pre-wrap break-all">
                  {selected.result?.trim() ? selected.result : t('tasks.detailResultEmpty')}
                </pre>

                {selected.error ? (
                  <>
                    <h4 className="text-sm font-bold text-error mt-6 mb-3">{t('tasks.error')}</h4>
                    <pre className="text-xs font-mono bg-error/10 p-3 rounded-lg border border-error/30 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                      {selected.error}
                    </pre>
                  </>
                ) : null}

                <h4 className="text-sm font-bold text-on-surface mt-8 mb-4">{t('tasks.detailLogsTitle')}</h4>
                <div className="space-y-4 pl-1">
                  {selectedTaskLogs.length === 0 ? (
                    <p className="text-xs text-on-surface-variant">—</p>
                  ) : (
                    selectedTaskLogs.map((log, idx) => (
                      <div key={`${log.createdAt}-${idx}`} className="flex gap-3">
                        <div className="flex flex-col items-center pt-1.5 shrink-0">
                          <span className={cn('w-2.5 h-2.5 rounded-full', logDotClass(log.level))} />
                          {idx < selectedTaskLogs.length - 1 ? (
                            <span className="w-px flex-1 min-h-[1rem] bg-white/10 mt-1" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pb-2">
                          <p className="text-[10px] font-mono text-on-surface-variant">
                            {formatTaskDateTime(log.createdAt)} [{log.level}]
                          </p>
                          <p className="text-sm text-on-surface mt-0.5 whitespace-pre-wrap break-words">{log.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="p-6 sm:p-8 border-t border-white/5 flex gap-3 shrink-0">
                {isTaskTerminal(selected.status) ? (
                  <button
                    type="button"
                    onClick={() => void handleRetry(selected.id)}
                    className="flex-1 py-4 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={18} /> {t('common.retry')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel(selected.id)}
                    className="flex-1 py-4 bg-error/20 text-error border border-error/30 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Trash2 size={18} /> {t('tasks.cancel')}
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
