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
  Repeat,
  Braces,
  MessageCircle,
  Camera,
  X,
  Table2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { WfNodeData } from '@/src/lib/workflowGraph';
import {
  WF_HANDLE_BODY,
  WF_HANDLE_DONE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  nodeExportsStepVariables,
  nodePublishesWorkflowVar,
  resolveNodeOutputKey,
  resolveWorkflowVarName,
} from '@/src/lib/workflowGraph';
import { WfExportVarBadge } from './WfExportVarBadge';
import { WfWorkflowVarBadge } from './WfWorkflowVarBadge';
import { entryTriggerTypeSubtitle } from '@/src/lib/workflowEntryTrigger';
import { t } from '@/src/i18n/t';
import type { TaskType, WorkflowStepConfig } from '@/src/types/api';
import type { WorkflowTriggerType } from '@/src/api/triggers';

function kindIcon(kind: WfNodeData['kind'], taskType?: TaskType) {
  if (kind === 'trigger') return PlayCircle;
  if (kind === 'delay') return Clock;
  if (kind === 'condition') return GitBranch;
  if (kind === 'loop') return Repeat;
  if (kind === 'variable') return Braces;
  if (kind === 'excel') return Table2;
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
    case 'CLOSE_APP':
      return X;
    case 'CHROME_EXTENSION':
      return MousePointer2;
    case 'DESKTOP_AUTOMATION':
      return MousePointer2;
    case 'SCREEN_CAPTURE':
      return Camera;
    case 'HTTP_REQUEST':
      return Globe;
    case 'TELEGRAM_SEND':
      return MessageCircle;
    default:
      return Terminal;
  }
}

/** Chiều cao cố định phía trên card — giữ handle thẳng hàng dù có/không badge biến. */
const VAR_BADGE_SLOT_CLASS = 'h-9 w-full flex items-end justify-center shrink-0';

function triggerKindLabel(d: WfNodeData): string {
  const tt = (d.config as WorkflowStepConfig & { triggerType?: WorkflowTriggerType })
    ?.triggerType;
  if (tt === 'SCHEDULE' || tt === 'TELEGRAM' || tt === 'MANUAL') {
    return entryTriggerTypeSubtitle(tt);
  }
  return t('workflows.triggerManual');
}

function WfFlowNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as WfNodeData;
  const Icon = kindIcon(d.kind, d.taskType);
  const run = d.runStatus ?? 'idle';
  const isCondition = d.kind === 'condition';
  const isLoop = d.kind === 'loop';
  const isVariable = d.kind === 'variable';
  const isExcel = d.kind === 'excel';
  const isTrigger = d.kind === 'trigger';
  const exportsStepVar = nodeExportsStepVariables(d.kind, d.config);
  const outputKey = exportsStepVar ? resolveNodeOutputKey(d, id) : null;
  const workflowVarName =
    nodePublishesWorkflowVar(d.kind, d.config) ? resolveWorkflowVarName(d.kind, d.config) : null;

  return (
    <div className="flex flex-col items-center">
      <div
        className={VAR_BADGE_SLOT_CLASS}
        aria-hidden={!outputKey && !workflowVarName}
      >
        {workflowVarName ? (
          <WfWorkflowVarBadge varName={workflowVarName} />
        ) : outputKey ? (
          <WfExportVarBadge outputKey={outputKey} />
        ) : null}
      </div>
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
        isLoop && 'border-violet-400/30',
        isVariable && 'border-emerald-400/30',
        isExcel && 'border-teal-400/30',
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5" />

      <div className="flex items-start gap-2">
        <Icon
          size={18}
          className={cn(
            'shrink-0 mt-0.5',
            isCondition
              ? 'text-amber-400'
              : isLoop
                ? 'text-violet-400'
                : isVariable
                  ? 'text-emerald-400'
                  : isExcel
                    ? 'text-teal-400'
                    : 'text-primary',
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-mono uppercase text-on-surface-variant tracking-wide">
            {isTrigger
              ? triggerKindLabel(d)
              : d.kind === 'delay'
                ? 'DELAY'
                : d.kind === 'condition'
                  ? t('workflows.nodeType.CONDITION')
                  : d.kind === 'loop'
                    ? t('workflows.nodeType.LOOP')
                    : d.kind === 'variable'
                      ? t('workflows.nodeType.VARIABLE')
                      : d.kind === 'excel'
                        ? t('workflows.nodeType.EXCEL')
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

      {isLoop ? (
        <div className="flex justify-end gap-6 mt-3 pr-1 text-[9px] font-bold">
          <span className="text-violet-300">{t('workflows.branchBody')}</span>
          <span className="text-on-surface-variant">{t('workflows.branchDone')}</span>
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
      ) : isLoop ? (
        <>
          <Handle
            id={WF_HANDLE_BODY}
            type="source"
            position={Position.Right}
            style={{ top: '38%' }}
            className="!bg-violet-400 !w-2.5 !h-2.5"
          />
          <Handle
            id={WF_HANDLE_DONE}
            type="source"
            position={Position.Right}
            style={{ top: '68%' }}
            className="!bg-on-surface-variant !w-2.5 !h-2.5"
          />
        </>
      ) : (
        <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
      )}
    </div>
    </div>
  );
}

export const WfFlowNode = memo(WfFlowNodeComponent);
