import {
  Plus,
  Layers,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import { t } from '@/src/i18n/t';
import type { Workflow } from '@/src/types/api';

function formatUpdated(wf: Workflow): string {
  const at = wf.updatedAt;
  if (!at) return t('workflows.never');
  try {
    return new Date(at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return at;
  }
}

type Props = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  search: string;
  onSearchChange: (q: string) => void;
  items: Workflow[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  creating?: boolean;
  loading?: boolean;
  page: number;
  pageLimit: number;
  total: number;
  onPageChange: (p: number) => void;
};

export function WorkflowListSidebar({
  collapsed,
  onToggleCollapse,
  search,
  onSearchChange,
  items,
  activeId,
  onSelect,
  onCreate,
  creating,
  loading,
  page,
  pageLimit,
  total,
  onPageChange,
}: Props) {
  if (collapsed) {
    return (
      <aside className="w-[3.25rem] border-r border-white/5 bg-surface-container-low/50 flex flex-col items-center py-4 gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t('workflows.expandList')}
          className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center"
        >
          <PanelLeftOpen size={18} />
        </button>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          title={t('workflows.newWorkflow')}
          className="w-9 h-9 rounded-lg bg-primary/15 text-primary border border-primary/25 flex items-center justify-center disabled:opacity-40"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
        </button>
        <div className="flex-1 overflow-y-auto custom-scrollbar w-full flex flex-col items-center gap-1.5 py-1">
          {items.map((wf) => (
            <button
              key={wf.id}
              type="button"
              title={wf.name}
              onClick={() => onSelect(wf.id)}
              className={cn(
                'w-9 h-9 rounded-lg text-[10px] font-bold font-mono border transition-colors',
                activeId === wf.id
                  ? 'bg-primary/25 border-primary/50 text-primary'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {wf.name.slice(0, 2).toUpperCase()}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-52 xl:w-52 border-r border-white/5 bg-surface-container-low/50 flex flex-col shrink-0">
      <div className="p-3 space-y-2 border-b border-white/5">
        <div className="flex items-center justify-between gap-1.5">
          <h2 className="text-lg font-bold flex items-center gap-1.5 min-w-0">
            <Layers size={16} className="text-primary shrink-0" />
            <span className="truncate">{t('workflows.title')}</span>
          </h2>
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={onToggleCollapse}
              title={t('workflows.collapseList')}
              className="w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center"
            >
              <PanelLeftClose size={15} />
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={creating}
              title={t('workflows.newWorkflow')}
              className="w-8 h-8 rounded-lg bg-primary/15 text-primary border border-primary/25 flex items-center justify-center disabled:opacity-40"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
            </button>
          </div>
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50"
            size={14}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('workflows.filterPlaceholder')}
            className="w-full bg-black/20 border border-white/8 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 py-2 min-h-0">
        {loading ? (
          <p className="text-xs text-on-surface-variant px-3 py-6 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            {t('automations.loading')}
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-on-surface-variant px-3 py-6">
            {search.trim() ? t('workflows.noSearchResults') : t('workflows.emptyList')}
          </p>
        ) : (
          items.map((wf) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => onSelect(wf.id)}
              className={cn(
                'w-full mb-1 p-2.5 rounded-xl text-left border transition-all',
                activeId === wf.id
                  ? 'bg-primary/8 border-primary/25 shadow-md shadow-primary/5'
                  : 'border-transparent hover:bg-white/5',
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-bold text-xs truncate">{wf.name}</span>
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0 mt-1.5',
                    wf.isActive ? 'bg-primary animate-pulse' : 'bg-white/15',
                  )}
                />
              </div>
              {wf.description ? (
                <p className="text-[10px] text-on-surface-variant/70 line-clamp-2 mb-2">
                  {wf.description}
                </p>
              ) : null}
              <div className="flex items-center justify-between text-[9px] font-mono text-on-surface-variant/50">
                <span>{formatUpdated(wf)}</span>
                <span>{wf.steps?.length ?? 0} bước</span>
              </div>
            </button>
          ))
        )}
      </div>

      <Pagination
        page={page}
        limit={pageLimit}
        total={total}
        onPageChange={onPageChange}
        className="p-2 border-t border-white/5 shrink-0 text-xs"
      />
    </aside>
  );
}
