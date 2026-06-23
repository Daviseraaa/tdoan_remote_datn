import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Filter,
  GitBranch,
  History,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkflowCard } from '@/src/components/workflow/WorkflowCard';
import { WorkflowRunDetailDrawer } from '@/src/components/workflow/WorkflowRunDetailDrawer';
import { WorkflowRunHistoryRow } from '@/src/components/workflow/WorkflowRunHistoryRow';
import { Pagination } from '@/src/components/Pagination';
import { TaskEmptyState } from '@/src/components/tasks/TaskEmptyState';
import { useAgentsList } from '@/src/hooks/useAgents';
import { createDefaultWorkflow, createWorkflowFromConfigFile } from '@/src/hooks/useWorkflowEditor';
import { parseWorkflowConfigFileText } from '@/src/lib/workflowConfigFile';
import { useWorkflowRunsList } from '@/src/hooks/useWorkflowRuns';
import { useWorkflowMutations, useWorkflowsList } from '@/src/hooks/useWorkflows';
import { filterAgentsByCluster } from '@/src/lib/agentFilters';
import { apiErrorMessage } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { WorkflowRunListItem, WorkflowRunStatus } from '@/src/types/api';

const PAGE_LIMIT = 20;

type WorkflowTab = 'list' | 'history';

const RUN_STATUSES = [
  '',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PENDING',
  'CANCELLED',
] as const;

export default function Workflows() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<WorkflowTab>('list');
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WorkflowRunStatus | ''>('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const { data: listData, isLoading: listLoading } = useWorkflowsList({
    page,
    limit: PAGE_LIMIT,
  });
  const { data: historyData, isLoading: historyLoading } = useWorkflowRunsList({
    page: historyPage,
    limit: PAGE_LIMIT,
    status: statusFilter,
  });
  const { create, remove, execute } = useWorkflowMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });

  const agents = useMemo(
    () => filterAgentsByCluster(agentsPage?.items ?? [], 'all'),
    [agentsPage?.items],
  );

  const items = listData?.items ?? [];
  const filteredItems = useMemo(
    () => items.filter((w) => w.name.toLowerCase().includes(search.trim().toLowerCase())),
    [items, search],
  );
  const listTotal = listData?.meta.total ?? 0;
  const historyRuns = historyData?.items ?? [];
  const historyTotal = historyData?.meta.total ?? 0;

  const selectedRunFallback = useMemo(
    () => historyRuns.find((r) => r.id === selectedRunId) ?? null,
    [historyRuns, selectedRunId],
  );

  useEffect(() => {
    const legacyId = searchParams.get('workflowId');
    if (legacyId) {
      navigate(`/workflows/${legacyId}/edit`, { replace: true });
    }
  }, [searchParams, navigate]);

  useEffect(() => {
    setHistoryPage(1);
  }, [statusFilter]);

  const handleCreate = async () => {
    setError('');
    try {
      const created = await createDefaultWorkflow(create, agents);
      if (created) navigate(`/workflows/${created.id}/edit`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleImportConfig = async (file: File) => {
    setError('');
    try {
      const text = await file.text();
      const parsed = parseWorkflowConfigFileText(text);
      const created = await createWorkflowFromConfigFile(create, agents, parsed);
      navigate(`/workflows/${created.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : apiErrorMessage(err));
    }
  };

  const pickImportFile = () => {
    importInputRef.current?.click();
  };

  const handleRun = async (id: string) => {
    setError('');
    try {
      await execute.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    setError('');
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openEditor = (id: string) => {
    navigate(`/workflows/${id}/edit`);
  };

  const tabBtn = (
    key: WorkflowTab,
    label: string,
    Icon: React.ComponentType<{ size?: number }>,
  ) => (
    <button
      type="button"
      onClick={() => setTab(key)}
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
      <header className="mb-6 sm:mb-8 flex flex-wrap justify-between items-end gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">
            {t('workflows.title')}
          </h2>
          <p className="prose-description text-on-surface-variant text-body-md mt-1">
            {t('workflows.subtitle')}
          </p>
        </div>
        {tab === 'list' ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json,.stationhub-workflow.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleImportConfig(file);
              }}
            />
            <button
              type="button"
              onClick={pickImportFile}
              disabled={create.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-white/10 hover:bg-white/5 disabled:opacity-50"
              title={t('workflows.configFile.importHint')}
            >
              <Upload size={18} />
              {t('workflows.configFile.import')}
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={create.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold disabled:opacity-50"
            >
              {create.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
              {create.isPending ? t('workflows.creating') : t('workflows.newWorkflow')}
            </button>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-on-surface-variant px-2">
            {t('workflows.historyCount', { n: String(historyTotal) })}
          </span>
        )}
      </header>

      <nav className="flex gap-1 border-b border-white/10 mb-6">
        {tabBtn('list', t('workflows.listTab'), GitBranch)}
        {tabBtn('history', t('workflows.historyTab'), History)}
      </nav>

      {tab === 'list' ? (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[12rem] max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('workflows.filterPlaceholder')}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-container-high/50 border border-white/10 text-sm focus:outline-none focus:border-primary/40"
            />
          </div>
          <span className="text-[10px] font-mono text-on-surface-variant px-2">
            {t('workflows.count', { n: listTotal })}
          </span>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-on-surface-variant shrink-0" />
          {RUN_STATUSES.map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                statusFilter === s ? 'bg-primary text-on-primary' : 'bg-white/5 text-on-surface-variant',
              )}
            >
              {s ? t(`status.${s}` as 'status.PENDING') : t('common.all')}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="p-1 hover:bg-white/5 rounded">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {tab === 'list' ? (
        listLoading ? (
          <div className="flex justify-center py-20 text-on-surface-variant">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : filteredItems.length === 0 ? (
          <TaskEmptyState
            icon={GitBranch}
            title={search.trim() ? t('workflows.noSearchResults') : t('workflows.emptyTitle')}
            description={search.trim() ? undefined : t('workflows.emptyHint')}
            action={
              !search.trim() ? (
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={create.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  <Plus size={18} />
                  {t('workflows.newWorkflow')}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  workflow={wf}
                  agents={agents}
                  onOpen={() => openEditor(wf.id)}
                  onRun={() => void handleRun(wf.id)}
                  onEdit={() => openEditor(wf.id)}
                  onDelete={() => void handleDelete(wf.id)}
                  runPending={execute.isPending}
                  deletePending={remove.isPending}
                />
              ))}
            </div>
            {listTotal > PAGE_LIMIT ? (
              <div className="mt-8">
                <Pagination
                  page={page}
                  limit={PAGE_LIMIT}
                  total={listTotal}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        )
      ) : historyLoading ? (
        <div className="flex justify-center py-20 text-on-surface-variant">
          <Loader2 className="animate-spin w-8 h-8" />
        </div>
      ) : historyRuns.length === 0 ? (
        <TaskEmptyState
          icon={History}
          title={t('workflows.historyEmpty')}
          description={t('workflows.historyEmptyHint')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {historyRuns.map((run: WorkflowRunListItem) => (
              <WorkflowRunHistoryRow
                key={run.id}
                run={run}
                onClick={() => setSelectedRunId(run.id)}
              />
            ))}
          </div>
          <Pagination
            page={historyPage}
            limit={PAGE_LIMIT}
            total={historyTotal}
            onPageChange={setHistoryPage}
            className="mt-6"
          />
        </>
      )}

      <WorkflowRunDetailDrawer
        runId={selectedRunId}
        fallback={selectedRunFallback}
        onClose={() => setSelectedRunId(null)}
      />
    </div>
  );
}
