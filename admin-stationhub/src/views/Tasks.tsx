import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  RotateCcw,
  Trash2,
  AlertCircle,
  Loader2,
  Filter,
  Layers,
  ListTodo,
  History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { CopyButton } from '@/src/components/CopyButton';
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
import { TaskEmptyState } from '@/src/components/tasks/TaskEmptyState';
import { TaskHistoryRow } from '@/src/components/tasks/TaskHistoryRow';
import { TaskStatusBadge } from '@/src/components/tasks/TaskStatusBadge';
import { TaskTemplateCard } from '@/src/components/tasks/TaskTemplateCard';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { TaskStatus, TaskType } from '@/src/types/api';
import { useAuth } from '@/src/hooks/useAuth';

const TASK_PAGE_LIMIT = 20;

type TaskTab = 'templates' | 'history';
type DetailTab = 'overview' | 'logs';

const TASK_TYPES: TaskType[] = [
  'COMMAND',
  'SCRIPT',
  'FILE_OPERATION',
  'SYSTEM_INFO',
  'OPEN_APP',
  'OPEN_BROWSER',
  'CLOSE_APP',
  'CHROME_EXTENSION',
  'DESKTOP_AUTOMATION',
  'SCREEN_CAPTURE',
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

function taskStatusFilterLabel(status: TaskStatus | ''): string {
  return status ? t(`status.${status}` as 'status.PENDING') : t('common.all');
}

function taskTypeFilterLabel(type: TaskType | ''): string {
  return type ? t(`taskType.${type}` as 'taskType.COMMAND') : t('common.all');
}

const FILTER_BTN =
  'flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-sm font-bold';

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
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
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

  const tasks = useMemo(() => {
    if (tab !== 'history') return [];
    const rows: ReturnType<typeof mapTaskToListRow>[] = [];
    for (const item of data?.items ?? []) {
      try {
        rows.push(mapTaskToListRow(item));
      } catch {
        /* bỏ qua bản ghi lỗi — tránh crash cả trang */
      }
    }
    return rows;
  }, [tab, data?.items]);
  const selected = selectedId ? detail ?? tasks.find((x) => x.id === selectedId)?._raw : null;
  const selectedTaskLogs = selected ? dedupeTaskLogs(selected.logs) : [];
  const templates = templatesPage?.items ?? [];
  const historyTotal = data?.meta.total ?? 0;

  const activeAgentName = (agentId: string) =>
    agentsPage?.items.find((a) => a.id === agentId)?.name ?? agentId;

  const openTaskDetail = (id: string) => {
    setSelectedId(id);
    setDetailTab('overview');
  };

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

  const tabBtn = (key: TaskTab, label: string, Icon: React.ComponentType<{ size?: number }>) => (
    <button
      type="button"
      onClick={() => {
        setTab(key);
        setStatusMenuOpen(false);
        setTypeMenuOpen(false);
      }}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors',
        tab === key
          ? 'border-primary text-primary'
          : 'border-transparent text-on-surface-variant hover:text-on-surface',
      )}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <div className="relative pb-16 min-w-0 max-w-full w-full">
      {/* Page header */}
      <header className="mb-6 sm:mb-8 flex flex-wrap justify-between items-end gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">{t('tasks.title')}</h2>
          <p className="prose-description text-on-surface-variant text-body-md mt-1">{t('tasks.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'history' ? (
            <>
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
              <span className="text-[10px] font-mono text-on-surface-variant px-2">
                {t('tasks.count', { n: historyTotal })}
              </span>
            </>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/tasks/templates/new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold"
              title={t('tasks.addTemplate')}
              aria-label={t('tasks.addTemplate')}
            >
              <Plus size={18} />
              {t('tasks.addTemplate')}
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-white/10 mb-6">
        {tabBtn('templates', t('tasks.templatesTab'), ListTodo)}
        {tabBtn('history', t('tasks.historyTab'), History)}
      </nav>

      {error ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="p-1 hover:bg-white/5 rounded">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <>
          {templatesLoading ? (
            <div className="flex justify-center py-20 text-on-surface-variant">
              <Loader2 className="animate-spin w-8 h-8" />
            </div>
          ) : templates.length === 0 ? (
            <TaskEmptyState
              icon={ListTodo}
              title={t('tasks.templatesEmpty')}
              description={t('tasks.templatesEmptyHint')}
              action={
                <button
                  type="button"
                  onClick={() => navigate('/tasks/templates/new')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold"
                >
                  <Plus size={18} />
                  {t('tasks.addTemplate')}
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <TaskTemplateCard
                  key={tpl.id}
                  template={tpl}
                  agentLabel={tpl.agent?.name ?? activeAgentName(tpl.agentId)}
                  showOwner={isAdmin}
                  onRun={() => void handleRunTemplate(tpl.id)}
                  onEdit={() => navigate(`/tasks/templates/${tpl.id}/edit`)}
                  onDelete={() => void handleDeleteTemplate(tpl.id)}
                  runPending={runTpl.isPending}
                  deletePending={removeTpl.isPending}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {isLoading ? (
            <div className="flex justify-center py-20 text-on-surface-variant">
              <Loader2 className="animate-spin w-8 h-8" />
            </div>
          ) : tasks.length === 0 ? (
            <TaskEmptyState
              icon={History}
              title={t('tasks.empty')}
              description={t('tasks.historyEmptyHint')}
            />
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskHistoryRow key={task.id} task={task} onClick={() => openTaskDetail(task.id)} />
              ))}
            </div>
          )}
          <Pagination
            page={page}
            limit={TASK_PAGE_LIMIT}
            total={historyTotal}
            onPageChange={setPage}
            className="mt-6"
          />
        </>
      )}

      <AnimatePresence>
        {selectedId && selected ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => setSelectedId(null)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed top-0 right-0 h-full w-full max-w-[720px] bg-surface border-l border-white/10 z-[70] flex flex-col shadow-2xl"
            >
              <div className="p-4 sm:p-6 border-b border-white/5 shrink-0 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold truncate">
                      {t('tasks.detailTitle', { id: selected.id.slice(0, 8) })}
                    </h3>
                    <div className="mt-2">
                      <TaskStatusBadge status={selected.status} size="md" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="p-2 hover:bg-white/5 rounded-full shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex gap-2">
                  {(['overview', 'logs'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDetailTab(key)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-xs font-bold border transition-colors',
                        detailTab === key
                          ? 'bg-primary/15 border-primary/40 text-primary'
                          : 'border-white/10 text-on-surface-variant hover:text-on-surface',
                      )}
                    >
                      {key === 'overview'
                        ? t('tasks.detailTabOverview')
                        : t('tasks.detailTabLogs')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                {detailLoading && !detail ? (
                  <div className="flex justify-center py-12 text-on-surface-variant">
                    <Loader2 className="animate-spin w-8 h-8" />
                  </div>
                ) : null}

                {detailTab === 'overview' ? (
                  <div
                    className={cn(
                      detailLoading && !detail ? 'opacity-50 pointer-events-none' : '',
                    )}
                  >
                    <div className="rounded-xl border border-white/10 overflow-hidden bg-surface-container-low/20">
                      <TaskDetailRow label={t('tasks.detailId')}>
                        <span className="font-mono text-xs">{selected.id}</span>
                      </TaskDetailRow>
                      <TaskDetailRow label={t('common.type')}>
                        <span className="font-mono font-bold">{selected.type}</span>
                      </TaskDetailRow>
                      <TaskDetailRow label={t('tasks.agent')}>
                        {selected.agent?.name ?? selected.agentId}
                      </TaskDetailRow>
                      <TaskDetailRow label={t('tasks.detailExitCode')}>
                        {selected.exitCode != null ? String(selected.exitCode) : '—'}
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
                      <TaskDetailRow label={t('tasks.command')}>
                        <div className="space-y-2">
                          <div className="flex justify-end">
                            <CopyButton
                              text={selected.command ?? ''}
                              disabled={!(selected.command ?? '').trim()}
                              iconSize={14}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold uppercase text-on-surface-variant"
                              onError={() => setError(t('common.couldNotCopy'))}
                            />
                          </div>
                          <pre className="text-xs font-mono bg-surface-container-low p-3 rounded-lg border border-white/5 whitespace-pre-wrap break-all max-h-40 overflow-auto">
                            {selected.command ?? '—'}
                          </pre>
                        </div>
                      </TaskDetailRow>
                    </div>

                    <h4 className="text-sm font-bold text-on-surface mt-6 mb-2">
                      {t('tasks.detailResultTitle')}
                    </h4>
                    <pre className="text-xs font-mono bg-[#0b0f14] text-[#d4d4d4] p-3 rounded-lg border border-white/10 whitespace-pre-wrap break-all">
                      {selected.result?.trim() ? selected.result : t('tasks.detailResultEmpty')}
                    </pre>

                    {selected.error ? (
                      <>
                        <h4 className="text-sm font-bold text-error mt-4 mb-2">{t('tasks.error')}</h4>
                        <pre className="text-xs font-mono bg-error/10 p-3 rounded-lg border border-error/30 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                          {selected.error}
                        </pre>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-4 pl-1">
                    {selectedTaskLogs.length === 0 ? (
                      <p className="text-sm text-on-surface-variant py-8 text-center">—</p>
                    ) : (
                      selectedTaskLogs.map((log, idx) => (
                        <div key={`${log.createdAt}-${idx}`} className="flex gap-3">
                          <div className="flex flex-col items-center pt-1.5 shrink-0">
                            <span
                              className={cn('w-2.5 h-2.5 rounded-full', logDotClass(log.level))}
                            />
                            {idx < selectedTaskLogs.length - 1 ? (
                              <span className="w-px flex-1 min-h-[1rem] bg-white/10 mt-1" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1 pb-2">
                            <p className="text-[10px] font-mono text-on-surface-variant">
                              {formatTaskDateTime(log.createdAt)} [{log.level}]
                            </p>
                            <p className="text-sm text-on-surface mt-0.5 whitespace-pre-wrap break-words">
                              {log.message}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-white/5 flex gap-3 shrink-0">
                {isTaskTerminal(selected.status) ? (
                  <button
                    type="button"
                    onClick={() => void handleRetry(selected.id)}
                    className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                  >
                    <RotateCcw size={18} />
                    {t('common.retry')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleCancel(selected.id)}
                    className="flex-1 py-3.5 bg-error/20 text-error border border-error/30 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                  >
                    <Trash2 size={18} />
                    {t('tasks.cancel')}
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
