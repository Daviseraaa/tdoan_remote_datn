import { Braces } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatStepVar } from '@/src/lib/workflowGraph';

type Props = {
  outputKey: string;
  className?: string;
  compact?: boolean;
};

export function WfExportVarBadge({ outputKey, className, compact }: Props) {
  const ref = formatStepVar(outputKey, 'stdout');

  return (
    <div className={cn('pointer-events-none', compact ? 'inline-flex' : 'flex flex-col items-center', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/20',
          'font-mono font-bold text-primary whitespace-nowrap',
          compact ? 'px-1.5 py-0.5 max-w-[100px] text-[8px] leading-none' : 'px-2.5 py-1 max-w-[220px] text-[9px] shadow-md shadow-primary/10',
        )}
        title={t('workflows.exportVarTitle', { ref })}
      >
        <Braces size={compact ? 9 : 11} className="shrink-0 opacity-80" />
        <span className="truncate">{outputKey}</span>
      </div>
      {!compact ? <div className="w-px h-2 bg-primary/40" aria-hidden /> : null}
    </div>
  );
}
