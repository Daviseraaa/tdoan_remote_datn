import { Braces } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatWorkflowVar } from '@/src/lib/workflowGraph';

type Props = {
  varName: string;
  className?: string;
};

export function WfWorkflowVarBadge({ varName, className }: Props) {
  const ref = formatWorkflowVar(varName);

  return (
    <div className={cn('flex flex-col items-center pointer-events-none', className)}>
      <div
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-lg',
          'border border-emerald-400/50 bg-emerald-400/15 shadow-md shadow-emerald-400/10',
          'text-[9px] font-mono font-bold text-emerald-300 max-w-[220px]',
        )}
        title={t('workflows.workflowVarBadgeTitle', { ref })}
      >
        <Braces size={11} className="shrink-0 opacity-80" />
        <span className="truncate">{varName}</span>
      </div>
      <div className="w-px h-2 bg-emerald-400/40" aria-hidden />
    </div>
  );
}
