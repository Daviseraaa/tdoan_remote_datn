import { ArrowRight } from 'lucide-react';
import { taskTypeIcon } from '@/src/lib/taskTypeIcons';
import { TaskStatusBadge } from './TaskStatusBadge';
import { t } from '@/src/i18n/t';
import type { TaskStatus, TaskType } from '@/src/types/api';

export type TaskHistoryRowData = {
  id: string;
  shortId: string;
  type: string;
  status: TaskStatus;
  command: string;
  commandFull: string;
  agentName: string;
  updatedAt: string;
};

type Props = {
  task: TaskHistoryRowData;
  onClick: () => void;
};

export function TaskHistoryRow({ task, onClick }: Props) {
  const Icon = taskTypeIcon(task.type);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-white/5 bg-surface-container-low/40 px-4 py-3.5 flex items-center gap-4 hover:border-primary/30 hover:bg-surface-container-low/70 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-container-high/80 flex items-center justify-center shrink-0 group-hover:bg-primary/10">
        <Icon size={18} className="text-on-surface-variant group-hover:text-primary" />
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] lg:items-center gap-1 lg:gap-4">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-mono text-sm font-bold text-on-surface group-hover:text-primary">
            {task.shortId}
          </span>
          <TaskStatusBadge status={task.status} />
          <span className="text-[10px] font-mono text-on-surface-variant px-2 py-0.5 bg-white/5 rounded hidden sm:inline">
            {t(`taskType.${task.type as TaskType}` as 'taskType.COMMAND')}
          </span>
        </div>
        <p
          className="text-xs font-mono text-on-surface-variant truncate"
          title={task.commandFull}
        >
          {task.command}
        </p>
        <p className="text-[10px] text-on-surface-variant/70 lg:text-right whitespace-nowrap">
          {task.agentName} · {task.updatedAt}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="text-on-surface-variant opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
      />
    </button>
  );
}
