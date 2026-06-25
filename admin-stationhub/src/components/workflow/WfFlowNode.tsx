import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Zap,
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
import { resolveRecordingStepIcon } from '@/src/lib/recordingStepIcons';
import {
  WF_NODE_BODY_HEIGHT,
  WF_NODE_ICON_SIZE,
  WF_NODE_LABEL_INSET,
  WF_NODE_LABEL_WIDTH,
} from '@/src/lib/workflowGraph/nodeLayout';

export {
  WF_NODE_BODY_HEIGHT,
  WF_NODE_ICON_SIZE,
  WF_NODE_LABEL_INSET,
  WF_NODE_LABEL_WIDTH,
  WF_NODE_LABEL_WIDTH as WF_NODE_WIDTH,
};

const HANDLE_CLS = '!w-2 !h-2 !border-2 !border-[#0b0f14]';

function kindIcon(
  kind: WfNodeData['kind'],
  taskType?: TaskType,
  config?: WorkflowStepConfig,
) {
  if (kind === 'trigger') return Zap;
  if (kind === 'delay') return Clock;
  if (kind === 'condition') return GitBranch;
  if (kind === 'loop') return Repeat;
  if (kind === 'variable') return Braces;
  if (kind === 'excel') return Table2;
  if (kind === 'telegram') return MessageCircle;

  const recordingIcon = resolveRecordingStepIcon(taskType, config);
  if (recordingIcon) return recordingIcon;

  switch (taskType) {
    case 'SCRIPT':
      return FileCode;
    case 'SYSTEM_INFO':
      return Info;
    case 'OPEN_APP':
      return AppWindow;
    case 'OPEN_BROWSER':
      return Globe;
    case 'FOCUS_APP':
      return AppWindow;
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

function kindSubtitle(d: WfNodeData): string {
  if (d.kind === 'trigger') {
    const tt = (d.config as WorkflowStepConfig & { triggerType?: WorkflowTriggerType })
      ?.triggerType;
    if (tt === 'SCHEDULE' || tt === 'TELEGRAM' || tt === 'MANUAL') {
      return entryTriggerTypeSubtitle(tt);
    }
    return t('workflows.triggerManual');
  }
  if (d.kind === 'delay') return 'DELAY';
  if (d.kind === 'condition') return t('workflows.nodeType.CONDITION');
  if (d.kind === 'loop') return t('workflows.nodeType.LOOP');
  if (d.kind === 'variable') return t('workflows.nodeType.VARIABLE');
  if (d.kind === 'excel') return t('workflows.nodeType.EXCEL');
  if (d.kind === 'telegram') return t('workflows.nodeType.TELEGRAM');
  return t(`taskType.${d.taskType ?? 'COMMAND'}` as 'taskType.COMMAND');
}

function nodeTitle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '—';
  const parts = trimmed.split(' · ');
  const main = parts.length > 1 ? parts.slice(1).join(' · ') : trimmed;
  if (main.length <= 32) return main;
  return `${main.slice(0, 30)}…`;
}

function accentForKind(d: WfNodeData): {
  icon: string;
  box: string;
  border: string;
} {
  if (d.kind === 'trigger') {
    return {
      icon: 'text-amber-300',
      box: 'bg-amber-500/10',
      border: 'border-amber-400/35',
    };
  }
  if (d.kind === 'condition') {
    return {
      icon: 'text-amber-400',
      box: 'bg-amber-500/10',
      border: 'border-amber-400/30',
    };
  }
  if (d.kind === 'loop') {
    return {
      icon: 'text-violet-400',
      box: 'bg-violet-500/10',
      border: 'border-violet-400/30',
    };
  }
  if (d.kind === 'variable') {
    return {
      icon: 'text-emerald-400',
      box: 'bg-emerald-500/10',
      border: 'border-emerald-400/30',
    };
  }
  if (d.kind === 'excel') {
    return {
      icon: 'text-teal-400',
      box: 'bg-teal-500/10',
      border: 'border-teal-400/30',
    };
  }
  if (d.kind === 'delay') {
    return {
      icon: 'text-sky-300',
      box: 'bg-sky-500/10',
      border: 'border-sky-400/25',
    };
  }
  if (d.kind === 'telegram' || d.taskType === 'TELEGRAM_SEND') {
    return {
      icon: 'text-sky-400',
      box: 'bg-sky-500/10',
      border: 'border-sky-400/25',
    };
  }
  return {
    icon: 'text-primary',
    box: 'bg-primary/10',
    border: 'border-white/12',
  };
}

function RunStatusDot({ run }: { run: NonNullable<WfNodeData['runStatus']> }) {
  if (run === 'pending') {
    return <Circle size={10} className="text-on-surface-variant/70" />;
  }
  if (run === 'running') {
    return <Loader2 size={10} className="animate-spin text-primary" />;
  }
  if (run === 'completed') {
    return <CheckCircle2 size={10} className="text-tertiary" />;
  }
  if (run === 'failed') {
    return <AlertCircle size={10} className="text-error" />;
  }
  return <Circle size={10} className="text-on-surface-variant/35" />;
}

function WfFlowNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as WfNodeData;
  const Icon = kindIcon(d.kind, d.taskType, d.config);
  const run = d.runStatus ?? 'idle';
  const isCondition = d.kind === 'condition';
  const isLoop = d.kind === 'loop';
  const isTrigger = d.kind === 'trigger';
  const exportsStepVar = nodeExportsStepVariables(d.kind, d.config);
  const outputKey = exportsStepVar ? resolveNodeOutputKey(d, id) : null;
  const workflowVarName =
    nodePublishesWorkflowVar(d.kind, d.config) ? resolveWorkflowVarName(d.kind, d.config) : null;
  const accent = accentForKind(d);
  const title = nodeTitle(d.label);
  const subtitle = kindSubtitle(d);
  const hasVarBadge = Boolean(workflowVarName || outputKey);

  return (
    <div
      className="flex flex-col items-center select-none pointer-events-none overflow-visible"
      style={{ width: WF_NODE_ICON_SIZE, height: WF_NODE_BODY_HEIGHT }}
    >
      <div
        className="relative shrink-0 overflow-visible pointer-events-auto"
        style={{ width: WF_NODE_ICON_SIZE, height: WF_NODE_ICON_SIZE }}
      >
        {hasVarBadge ? (
          <div className="absolute left-1/2 bottom-full z-10 mb-1 -translate-x-1/2 w-max max-w-[108px] pointer-events-none">
            {workflowVarName ? (
              <WfWorkflowVarBadge varName={workflowVarName} compact />
            ) : outputKey ? (
              <WfExportVarBadge outputKey={outputKey} compact />
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            'w-full h-full rounded-[14px] border flex items-center justify-center transition-all shadow-sm',
            accent.box,
            accent.border,
            isTrigger && 'rounded-l-[10px] border-l-[3px] border-l-amber-400/70',
            selected && 'ring-2 ring-primary/80 ring-offset-2 ring-offset-[#0b0f14] shadow-primary/20',
            run === 'pending' && 'opacity-80',
            run === 'running' && 'border-primary/45 shadow-primary/15',
            run === 'completed' && 'border-tertiary/35',
            run === 'failed' && 'border-error/45',
            run === 'skipped' && 'opacity-45',
          )}
        >
          <Icon size={22} className={cn('shrink-0', accent.icon)} strokeWidth={2} />
        </div>

        {run !== 'idle' ? (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#0b0f14] border border-white/10 flex items-center justify-center"
            aria-hidden
          >
            <RunStatusDot run={run} />
          </div>
        ) : null}

        <Handle
          type="target"
          position={Position.Left}
          className={cn(HANDLE_CLS, '!bg-primary')}
        />

        {isCondition ? (
          <>
            <Handle
              id={WF_HANDLE_TRUE}
              type="source"
              position={Position.Right}
              style={{ top: '36%' }}
              className={cn(HANDLE_CLS, '!bg-tertiary')}
            />
            <Handle
              id={WF_HANDLE_FALSE}
              type="source"
              position={Position.Right}
              style={{ top: '64%' }}
              className={cn(HANDLE_CLS, '!bg-error')}
            />
          </>
        ) : isLoop ? (
          <>
            <Handle
              id={WF_HANDLE_BODY}
              type="source"
              position={Position.Right}
              style={{ top: '36%' }}
              className={cn(HANDLE_CLS, '!bg-violet-400')}
            />
            <Handle
              id={WF_HANDLE_DONE}
              type="source"
              position={Position.Right}
              style={{ top: '64%' }}
              className={cn(HANDLE_CLS, '!bg-on-surface-variant')}
            />
          </>
        ) : (
          <Handle
            type="source"
            position={Position.Right}
            className={cn(HANDLE_CLS, '!bg-primary')}
          />
        )}
      </div>

      <div
        className="mt-2 h-[34px] text-center pointer-events-none overflow-hidden"
        style={{
          width: WF_NODE_LABEL_WIDTH,
          marginLeft: -WF_NODE_LABEL_INSET,
          marginRight: -WF_NODE_LABEL_INSET,
        }}
      >
        <p className="text-[11px] font-semibold leading-tight text-on-surface truncate" title={d.label}>
          {title}
        </p>
        <p className="text-[9px] leading-tight text-on-surface-variant/80 truncate mt-0.5" title={subtitle}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export const WfFlowNode = memo(WfFlowNodeComponent);
