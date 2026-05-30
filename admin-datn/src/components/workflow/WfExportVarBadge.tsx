import { Braces } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatStepVar } from '@/src/lib/workflowGraph';

type Props = {
  outputKey: string;
  className?: string;
};

export function WfExportVarBadge({ outputKey, className }: Props) {
  const ref = formatStepVar(outputKey, 'stdout');

  return (
    <div className={cn('flex flex-col items-center pointer-events-none', className)}>
      <div
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-lg',
          'border border-primary/50 bg-primary/20 shadow-md shadow-primary/10',
          'text-[9px] font-mono font-bold text-primary max-w-[220px]',
        )}
        title={t('workflows.exportVarTitle', { ref })}
      >
        <Braces size={11} className="shrink-0 opacity-80" />
        <span className="truncate">{outputKey}</span>
      </div>
      <div className="w-px h-2 bg-primary/40" aria-hidden />
    </div>
  );
}
