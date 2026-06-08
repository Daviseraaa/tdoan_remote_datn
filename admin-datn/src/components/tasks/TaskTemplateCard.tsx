import { Play, Pencil, Trash2 } from 'lucide-react';
import { taskTypeIcon } from '@/src/lib/taskTypeIcons';
import { formatTemplateCommandPreview } from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import type { TaskTemplate, TaskType } from '@/src/types/api';

type Props = {
  template: TaskTemplate;
  agentLabel: string;
  showOwner: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  runPending?: boolean;
  deletePending?: boolean;
};

export function TaskTemplateCard({
  template,
  agentLabel,
  showOwner,
  onRun,
  onEdit,
  onDelete,
  runPending,
  deletePending,
}: Props) {
  const Icon = taskTypeIcon(template.type);
  const typeLabel = t(`taskType.${template.type}` as 'taskType.COMMAND');
  let commandPreview = '—';
  try {
    commandPreview = formatTemplateCommandPreview(template);
  } catch {
    const cmd = (template.command ?? '').trim();
    commandPreview = cmd.length > 96 ? `${cmd.slice(0, 96)}…` : cmd || '—';
  }

  return (
    <article className="glass-card rounded-2xl border border-white/5 p-5 flex flex-col h-full hover:border-primary/25 transition-colors group">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Icon size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
            {template.name}
          </h3>
          <p className="text-[10px] font-mono text-on-surface-variant mt-1 uppercase tracking-wide">
            {typeLabel}
          </p>
        </div>
      </div>

      {showOwner && template.user ? (
        <p className="text-[10px] text-on-surface-variant mt-3 truncate">
          {t('tasks.templateOwner', { name: template.user.name, email: template.user.email })}
        </p>
      ) : null}

      <p className="text-[10px] font-mono text-on-surface-variant/80 mt-2">{agentLabel}</p>

      <div className="line-clamp-box flex-1 mt-3">
        <p
          className="line-clamp-text text-xs font-mono text-on-surface-variant [-webkit-line-clamp:2] break-all w-full"
          title={commandPreview}
        >
          {commandPreview}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
        <button
          type="button"
          onClick={onRun}
          disabled={runPending}
          className="flex-1 min-w-[7rem] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
        >
          <Play size={14} />
          {t('tasks.runTemplate')}
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
