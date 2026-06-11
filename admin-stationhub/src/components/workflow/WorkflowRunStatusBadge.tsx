import { AlertCircle, CheckCircle2, Clock, Loader2, MinusCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { WorkflowRunStatus } from '@/src/types/api';

function statusStyle(status: WorkflowRunStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-tertiary/10 text-tertiary border-tertiary/20';
    case 'FAILED':
      return 'bg-error/10 text-error border-error/20';
    case 'RUNNING':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'CANCELLED':
      return 'bg-white/5 text-on-surface-variant border-white/10';
    default:
      return 'bg-secondary-container/20 text-on-secondary-container border-white/10';
  }
}

function StatusIcon({ status }: { status: WorkflowRunStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={14} />;
  if (status === 'FAILED') return <AlertCircle size={14} />;
  if (status === 'RUNNING') return <Loader2 size={14} className="animate-spin" />;
  if (status === 'CANCELLED') return <MinusCircle size={14} />;
  return <Clock size={14} />;
}

type Props = {
  status: WorkflowRunStatus;
  className?: string;
  size?: 'sm' | 'md';
};

export function WorkflowRunStatusBadge({ status, className, size = 'sm' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-bold uppercase',
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]',
        statusStyle(status),
        className,
      )}
    >
      <StatusIcon status={status} />
      {t(`status.${status}` as 'status.PENDING')}
    </span>
  );
}
