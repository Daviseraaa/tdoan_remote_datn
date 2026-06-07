import { GitBranch, Pencil, Play, Trash2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { Workflow } from '@/src/types/api';

function formatUpdated(wf: Workflow): string {
  const at = wf.updatedAt ?? wf.lastExecutedAt;
  if (!at) return t('workflows.never');
  try {
    return new Date(at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return at;
  }
}

type Props = {
  workflow: Workflow;
  onOpen: () => void;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  runPending?: boolean;
  deletePending?: boolean;
};

export function WorkflowCard({
  workflow,
  onOpen,
  onRun,
  onEdit,
  onDelete,
  runPending,
  deletePending,
}: Props) {
  const stepCount = workflow.steps?.length ?? 0;
  const description = (workflow.description ?? '').trim();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="glass-card rounded-2xl border border-white/5 p-5 flex flex-col h-full hover:border-primary/25 transition-colors group cursor-pointer text-left"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <GitBranch size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
            {workflow.name}
          </h3>
          <p className="text-[10px] font-mono text-on-surface-variant mt-1 uppercase tracking-wide">
            {t('workflows.stepCount', { n: String(stepCount) })}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 w-2 h-2 rounded-full mt-2',
            workflow.isActive ? 'bg-success' : 'bg-on-surface-variant/40',
          )}
          title={workflow.isActive ? t('workflows.isActive') : t('workflows.inactive')}
        />
      </div>

      <p
        className="text-xs text-on-surface-variant mt-3 line-clamp-2 break-words flex-1 min-h-[2.5rem]"
        title={description || undefined}
      >
        {description || t('workflows.newDescription')}
      </p>

      <p className="text-[10px] font-mono text-on-surface-variant/80 mt-2">
        {t('workflows.updatedAt', { at: formatUpdated(workflow) })}
      </p>

      <div
        className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onRun}
          disabled={runPending}
          className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
        >
          <Play size={14} />
          {t('workflows.runWorkflow')}
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-2 rounded-xl border border-white/10 text-on-surface-variant hover:text-on-surface text-xs font-bold inline-flex items-center gap-1"
        >
          <Pencil size={14} />
          {t('common.edit')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deletePending}
          className="px-3 py-2 rounded-xl border border-error/30 text-error text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}
