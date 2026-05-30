import type { ReactNode } from 'react';
import { ArrowLeft, Eye } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import {
  RECORDING_HEADER_BTN_BACK_MOBILE,
  RECORDING_HEADER_BTN_SECONDARY,
} from './recordingHeaderStyles';
import { RecordingFlowToolbar } from './RecordingFlowToolbar';

type Props = {
  compact?: boolean;
  title: string;
  subtitle?: string;
  backLabel: string;
  onBack: () => void;
  readOnly?: boolean;
  readOnlyHint?: string;
  stepCount: number;
  message?: string;
  toolbar?: ReactNode;
};

export function RecordingFlowHeader({
  compact,
  title,
  subtitle,
  backLabel,
  onBack,
  readOnly,
  readOnlyHint,
  stepCount,
  message,
  toolbar,
}: Props) {
  const stepCountLabel = t('chromeScripts.steps');

  const toolbarDesktop = toolbar && !compact;

  return (
    <header className="shrink-0 border-b border-white/5 bg-surface-container-low/30 pt-[env(safe-area-inset-top,0px)]">
      <div
        className={cn(
          'flex gap-2 px-3',
          compact ? 'items-start py-2' : 'items-center py-2.5',
        )}
      >
        <button
          type="button"
          onClick={onBack}
          className={compact ? RECORDING_HEADER_BTN_BACK_MOBILE : RECORDING_HEADER_BTN_SECONDARY}
          title={backLabel}
          aria-label={backLabel}
        >
          <ArrowLeft size={16} className="shrink-0" />
          {!compact ? <span>{backLabel}</span> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            {readOnly ? <Eye size={16} className="text-primary shrink-0" /> : null}
            <h1
              className={cn(
                'font-bold truncate text-on-surface',
                compact ? 'text-sm' : 'text-base',
              )}
              title={title}
            >
              {title}
            </h1>
            <span className="text-[10px] font-mono font-bold text-on-surface-variant px-2 py-0.5 rounded-md bg-white/5 border border-white/10 shrink-0">
              {stepCount} {stepCountLabel}
            </span>
          </div>
          {subtitle ? (
            <p className="text-[11px] text-on-surface-variant truncate mt-0.5" title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>

        {toolbarDesktop ? (
          <div className="flex items-center gap-2 shrink-0">{toolbar}</div>
        ) : null}
      </div>

      {message ? (
        <p className="px-3 pb-2 text-[11px] font-mono text-amber-200/90 truncate">{message}</p>
      ) : null}

      {readOnly && readOnlyHint && !compact ? (
        <p className="mx-3 mb-2 text-xs text-on-surface-variant flex items-start gap-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <Eye size={14} className="shrink-0 text-primary mt-0.5" />
          {readOnlyHint}
        </p>
      ) : null}

      {toolbar && compact ? (
        <RecordingFlowToolbar compact>{toolbar}</RecordingFlowToolbar>
      ) : null}
    </header>
  );
}
