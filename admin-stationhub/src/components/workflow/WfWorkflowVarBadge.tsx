import { Braces } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatWorkflowVar } from '@/src/lib/workflowGraph';

type Props = {
  varName: string;
  className?: string;
  compact?: boolean;
};

export function WfWorkflowVarBadge({ varName, className, compact }: Props) {
  const ref = formatWorkflowVar(varName);

  return (
    <div className={cn('pointer-events-none', compact ? 'inline-flex' : 'flex flex-col items-center', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-emerald-400/50 bg-emerald-400/15',
          'font-mono font-bold text-emerald-300 whitespace-nowrap',
          compact ? 'px-1.5 py-0.5 max-w-[100px] text-[8px] leading-none' : 'px-2.5 py-1 max-w-[220px] text-[9px] shadow-md shadow-emerald-400/10',
        )}
        title={t('workflows.workflowVarBadgeTitle', { ref })}
      >
        <Braces size={compact ? 9 : 11} className="shrink-0 opacity-80" />
        <span className="truncate">{varName}</span>
      </div>
      {!compact ? <div className="w-px h-2 bg-emerald-400/40" aria-hidden /> : null}
    </div>
  );
}
