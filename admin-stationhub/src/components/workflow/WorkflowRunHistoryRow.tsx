import { ArrowRight, GitBranch } from 'lucide-react';
import { formatTaskDateTime } from '@/src/lib/taskDetailFormat';
import { WorkflowRunStatusBadge } from './WorkflowRunStatusBadge';
import { t } from '@/src/i18n/t';
import type { WorkflowRunListItem } from '@/src/types/api';

function triggerLabel(type: string | null | undefined): string {
  switch (type) {
    case 'MANUAL':
      return t('workflows.triggerManual');
    case 'SCHEDULE':
      return t('workflows.triggerSchedule');
    case 'TELEGRAM':
      return t('workflows.triggerTelegram');
    default:
      return t('workflows.manualTrigger');
  }
}

type Props = {
  run: WorkflowRunListItem;
  onClick: () => void;
};

export function WorkflowRunHistoryRow({ run, onClick }: Props) {
  const shortId = run.id.slice(0, 8);
  const stepCount = run._count?.stepRuns;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/5 bg-surface-container-low/40 px-4 py-3.5 flex items-center gap-4 hover:border-primary/30 hover:bg-surface-container-low/70 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-container-high/80 flex items-center justify-center shrink-0 group-hover:bg-primary/10">
        <GitBranch size={18} className="text-on-surface-variant group-hover:text-primary" />
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-center gap-1 lg:gap-4">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-mono text-sm font-bold text-on-surface group-hover:text-primary">
            {shortId}
          </span>
          <WorkflowRunStatusBadge status={run.status} />
        </div>
        <p className="text-xs text-on-surface-variant truncate" title={run.workflow.name}>
          {run.workflow.name}
          {stepCount != null ? (
            <span className="text-on-surface-variant/60">
              {' · '}
              {t('workflows.historyStepCount', { n: String(stepCount) })}
            </span>
          ) : null}
        </p>
        <p className="text-[10px] text-on-surface-variant/70 lg:text-right whitespace-nowrap">
          {triggerLabel(run.triggerType)} · {formatTaskDateTime(run.startedAt)}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="text-on-surface-variant opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
      />
    </button>
  );
}
