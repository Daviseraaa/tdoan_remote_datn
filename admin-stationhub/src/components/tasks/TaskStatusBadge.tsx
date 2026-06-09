import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { TaskStatus } from '@/src/types/api';

export function statusStyle(status: TaskStatus) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-tertiary/10 text-tertiary border-tertiary/20';
    case 'FAILED':
    case 'TIMEOUT':
      return 'bg-error/10 text-error border-error/20';
    case 'RUNNING':
      return 'bg-primary/10 text-primary border-primary/20';
    case 'QUEUED':
      return 'bg-secondary-container/30 text-secondary-container border-white/10';
    case 'CANCELLED':
      return 'bg-white/5 text-on-surface-variant border-white/10';
    default:
      return 'bg-secondary-container/20 text-on-secondary-container border-white/10';
  }
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={14} />;
  if (status === 'FAILED' || status === 'TIMEOUT') return <AlertCircle size={14} />;
  if (status === 'RUNNING' || status === 'QUEUED') {
    return <Loader2 size={14} className="animate-spin" />;
  }
  return <Clock size={14} />;
}

type Props = {
  status: TaskStatus;
  className?: string;
  size?: 'sm' | 'md';
};

export function TaskStatusBadge({ status, className, size = 'sm' }: Props) {
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
