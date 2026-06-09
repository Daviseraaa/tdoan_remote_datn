import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  AppWindow,
  Camera,
  Clock,
  Command,
  Eye,
  Globe,
  Keyboard,
  MousePointer2,
  Move,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type { RecordingFlowNodeData } from '@/src/lib/recordingFlow/types';

function chromeIcon(action: string) {
  switch (action) {
    case 'click':
      return MousePointer2;
    case 'fill':
      return Keyboard;
    case 'delay':
      return Clock;
    case 'waitFor':
      return Eye;
    case 'snapshotDom':
      return Camera;
    default:
      return Globe;
  }
}

function desktopIcon(action: string) {
  switch (action) {
    case 'delay':
      return Clock;
    case 'openApp':
      return AppWindow;
    case 'move':
      return Move;
    case 'click':
      return MousePointer2;
    case 'typeText':
      return Keyboard;
    case 'keyCombo':
      return Command;
    case 'scroll':
      return ScrollText;
    default:
      return MousePointer2;
  }
}

function RecordingFlowNodeComponent({ data, selected }: NodeProps) {
  const d = data as RecordingFlowNodeData;
  const Icon = d.module === 'chrome' ? chromeIcon(d.action) : desktopIcon(d.action);

  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'min-w-[160px] max-w-[220px] sm:min-w-[200px] sm:max-w-[240px] glass-card rounded-2xl p-3 sm:p-4 border-2 transition-all',
          selected
            ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/20'
            : 'border-white/10',
        )}
      >
        <Handle type="target" position={Position.Left} className="!bg-primary !w-2.5 !h-2.5" />

        <div className="flex items-start gap-2">
          <Icon size={18} className="shrink-0 mt-0.5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-mono uppercase text-on-surface-variant tracking-wide">
              {d.actionLabel}
            </p>
            <p className="font-bold text-sm text-on-surface truncate" title={d.label}>
              {d.label}
            </p>
            <p
              className="text-[11px] text-on-surface-variant mt-1 truncate font-mono"
              title={d.summary}
            >
              {d.summary}
            </p>
          </div>
        </div>

        <Handle type="source" position={Position.Right} className="!bg-primary !w-2.5 !h-2.5" />
      </div>
    </div>
  );
}

export const RecordingFlowNode = memo(RecordingFlowNodeComponent);
