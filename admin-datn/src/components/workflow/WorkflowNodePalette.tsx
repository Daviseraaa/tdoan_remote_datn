import {
  Clock,
  Terminal,
  FileCode,
  Info,
  AppWindow,
  MousePointer2,
  GitBranch,
  MessageCircle,
} from 'lucide-react';
import { t } from '@/src/i18n/t';
import type { TaskType } from '@/src/types/api';

const TASK_ITEMS: { type: TaskType; icon: typeof Terminal }[] = [
  { type: 'COMMAND', icon: Terminal },
  { type: 'SCRIPT', icon: FileCode },
  { type: 'SYSTEM_INFO', icon: Info },
  { type: 'OPEN_APP', icon: AppWindow },
  { type: 'DESKTOP_AUTOMATION', icon: MousePointer2 },
];

type Props = {
  onAddDelay: () => void;
  onAddCondition: () => void;
  onAddTelegram: () => void;
  onAddTask: (type: TaskType) => void;
  collapsed?: boolean;
  chainNextStep?: boolean;
};

export function WorkflowNodePalette({
  onAddDelay,
  onAddCondition,
  onAddTelegram,
  onAddTask,
  collapsed,
  chainNextStep,
}: Props) {
  if (collapsed) {
    return (
      <div className="w-12 border-r border-white/5 flex flex-col items-center py-3 gap-2 shrink-0">
        {TASK_ITEMS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            title={t(`taskType.${type}` as 'taskType.COMMAND')}
            onClick={() => onAddTask(type)}
            className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center text-primary"
          >
            <Icon size={16} />
          </button>
        ))}
        <button
          type="button"
          title={t('workflows.nodeDelay', { ms: 1000 })}
          onClick={onAddDelay}
          className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center"
        >
          <Clock size={16} />
        </button>
        <button
          type="button"
          title={t('workflows.nodeCondition')}
          onClick={onAddCondition}
          className="w-9 h-9 rounded-lg border border-amber-400/30 hover:bg-amber-400/10 flex items-center justify-center text-amber-400"
        >
          <GitBranch size={16} />
        </button>
        <button
          type="button"
          title={t('workflows.nodeTelegram')}
          onClick={onAddTelegram}
          className="w-9 h-9 rounded-lg border border-sky-400/30 hover:bg-sky-400/10 flex items-center justify-center text-sky-400"
        >
          <MessageCircle size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-white/5 bg-surface-container-low/30 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
      <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant px-4 pt-4 pb-2">
        {t('workflows.paletteTitle')}
      </p>
      <p className="text-[9px] font-mono text-on-surface-variant/60 px-4 pb-2">
        {t('workflows.paletteControl')}
      </p>
      <p className="text-[9px] text-on-surface-variant/50 px-4 pb-2 leading-snug">
        {chainNextStep ? t('workflows.addNodeChain') : t('workflows.addNodeFree')}
      </p>
      <button
        type="button"
        onClick={onAddDelay}
        className="mx-2 mb-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-left text-sm font-bold"
      >
        <Clock size={16} className="text-primary shrink-0" />
        {t('workflows.nodeDelay', { ms: 1000 })}
      </button>
      <button
        type="button"
        onClick={onAddCondition}
        className="mx-2 mb-2 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-400/25 hover:bg-amber-400/10 text-left text-sm font-bold"
      >
        <GitBranch size={16} className="text-amber-400 shrink-0" />
        {t('workflows.nodeCondition')}
      </button>
      <button
        type="button"
        onClick={onAddTelegram}
        className="mx-2 mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-sky-400/25 hover:bg-sky-400/10 text-left text-sm font-bold"
      >
        <MessageCircle size={16} className="text-sky-400 shrink-0" />
        {t('workflows.paletteTelegram')}
      </button>
      <p className="text-[9px] font-mono text-on-surface-variant/60 px-4 pb-2">
        {t('workflows.paletteAgent')}
      </p>
      <div className="px-2 pb-4 space-y-1">
        {TASK_ITEMS.map(({ type, icon: Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => onAddTask(type)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 hover:border-primary/30 text-left text-sm font-bold transition-all"
          >
            <Icon size={16} className="text-primary shrink-0" />
            <span className="truncate">{t(`taskType.${type}` as 'taskType.COMMAND')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
