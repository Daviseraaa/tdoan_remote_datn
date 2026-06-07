import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, GitBranch, Loader2, Plus, Search, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkflowCard } from '@/src/components/workflow/WorkflowCard';
import { Pagination } from '@/src/components/Pagination';
import { TaskEmptyState } from '@/src/components/tasks/TaskEmptyState';
import { useAgentsList } from '@/src/hooks/useAgents';
import { createDefaultWorkflow } from '@/src/hooks/useWorkflowEditor';
import { useWorkflowMutations, useWorkflowsList } from '@/src/hooks/useWorkflows';
import { filterAgentsByCluster } from '@/src/lib/agentFilters';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';

const PAGE_LIMIT = 20;

export default function Workflows() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const { data: listData, isLoading: listLoading } = useWorkflowsList({
    page,
    limit: PAGE_LIMIT,
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

  useEffect(() => {
    const legacyId = searchParams.get('workflowId');
    if (legacyId) {
      navigate(`/workflows/${legacyId}/edit`, { replace: true });
    }
  }, [searchParams, navigate]);

  const handleCreate = async () => {
    setError('');
    try {
      const created = await createDefaultWorkflow(create, agents);
      if (created) navigate(`/workflows/${created.id}/edit`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
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

  return (
    <div className="relative pb-16 min-w-0 max-w-full w-full">
      <header className="mb-6 sm:mb-8 flex flex-wrap justify-between items-end gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">
            {t('workflows.title')}
          </h2>
          <p className="text-on-surface-variant text-body-md mt-1 max-w-2xl">
            {t('workflows.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={create.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {create.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          {create.isPending ? t('workflows.creating') : t('workflows.newWorkflow')}
        </button>
      </header>

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

      {error ? (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="p-1 hover:bg-white/5 rounded">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {listLoading ? (
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
      )}
    </div>
  );
}
