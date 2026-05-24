import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  PlayCircle,
  Clock,
  Circle,
  Terminal,
  FileCode,
  Info,
  AppWindow,
  MousePointer2,
  Globe,
  AlertCircle,
  CheckCircle2,
  Loader2,
  GitBranch,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { WfNodeData } from '@/src/lib/workflowGraph';
import { WF_HANDLE_FALSE, WF_HANDLE_TRUE } from '@/src/lib/workflowGraph';
import { entryTriggerTypeSubtitle } from '@/src/lib/workflowEntryTrigger';
import { t } from '@/src/i18n/t';
import type { TaskType, WorkflowStepConfig } from '@/src/types/api';
import type { WorkflowTriggerType } from '@/src/api/triggers';

function kindIcon(kind: WfNodeData['kind'], taskType?: TaskType) {
  if (kind === 'trigger') return PlayCircle;
  if (kind === 'delay') return Clock;
  if (kind === 'condition') return GitBranch;
  if (kind === 'telegram') return MessageCircle;
  switch (taskType) {
    case 'SCRIPT':
      return FileCode;
    case 'SYSTEM_INFO':
      return Info;
    case 'OPEN_APP':
      return AppWindow;
    case 'OPEN_BROWSER':
      return Globe;
    case 'CHROME_EXTENSION':
      return MousePointer2;
    case 'DESKTOP_AUTOMATION':
      return MousePointer2;
    default:
      return Terminal;
  }
}

function triggerKindLabel(d: WfNodeData): string {
  const tt = (d.config as WorkflowStepConfig & { triggerType?: WorkflowTriggerType })
    ?.triggerType;
  if (tt === 'SCHEDULE' || tt === 'TELEGRAM' || tt === 'MANUAL') {
    return entryTriggerTypeSubtitle(tt);
  }
  return t('workflows.triggerManual');
}

function WfFlowNodeComponent({ data, selected }: NodeProps) {
  const d = data as WfNodeData;
  const Icon = kindIcon(d.kind, d.taskType);
  const run = d.runStatus ?? 'idle';
  const isCondition = d.kind === 'condition';
  const isTrigger = d.kind === 'trigger';

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[240px] glass-card rounded-2xl p-4 border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20' : 'border-white/10',
        run === 'pending' && 'border-white/15 opacity-80',
        run === 'running' && 'border-primary/50',
        run === 'completed' && 'border-tertiary/40',
        run === 'failed' && 'border-error/40',
        run === 'skipped' && 'border-white/10 opacity-50',
        isCondition && 'border-amber-400/30',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5" />

      <div className="flex items-start gap-2">
        <Icon size={18} className={cn('shrink-0 mt-0.5', isCondition ? 'text-amber-400' : 'text-primary')} />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase text-on-surface-variant tracking-wide">
            {isTrigger
              ? triggerKindLabel(d)
              : d.kind === 'delay'
                ? 'DELAY'
                : d.kind === 'condition'
                  ? t('workflows.nodeType.CONDITION')
                  : d.kind === 'telegram'
                    ? t('workflows.nodeType.TELEGRAM')
                    : t(`taskType.${d.taskType ?? 'COMMAND'}` as 'taskType.COMMAND')}
          </p>
          <p className="font-bold text-sm text-on-surface truncate" title={d.label}>
            {d.label}
          </p>
        </div>
        {run === 'pending' ? (
          <Circle size={14} className="text-on-surface-variant/60 shrink-0" />
        ) : run === 'running' ? (
          <Loader2 size={14} className="animate-spin text-primary shrink-0" />
        ) : run === 'completed' ? (
          <CheckCircle2 size={14} className="text-tertiary shrink-0" />
        ) : run === 'failed' ? (
          <AlertCircle size={14} className="text-error shrink-0" />
        ) : run === 'skipped' ? (
          <Circle size={14} className="text-on-surface-variant/40 shrink-0" />
        ) : null}
      </div>

      {isCondition ? (
        <div className="flex justify-end gap-6 mt-3 pr-1 text-[9px] font-bold">
          <span className="text-tertiary">{t('workflows.branchTrue')}</span>
          <span className="text-error/90">{t('workflows.branchFalse')}</span>
        </div>
      ) : null}

      {isCondition ? (
        <>
          <Handle
            id={WF_HANDLE_TRUE}
            type="source"
            position={Position.Right}
            style={{ top: '38%' }}
            className="!bg-tertiary !w-2.5 !h-2.5"
          />
          <Handle
            id={WF_HANDLE_FALSE}
            type="source"
            position={Position.Right}
            style={{ top: '68%' }}
            className="!bg-error !w-2.5 !h-2.5"
          />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
      )}
    </div>
  );
}

export const WfFlowNode = memo(WfFlowNodeComponent);
