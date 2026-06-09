import { ArrowLeft } from 'lucide-react';
import {
  RECORDING_HEADER_BTN_BACK_MOBILE,
  RECORDING_HEADER_BTN_SECONDARY,
} from '@/src/components/recordingFlow/recordingHeaderStyles';

type Props = {
  compact?: boolean;
  title: string;
  cancelLabel: string;
  onCancel: () => void;
};

export function TaskTemplateWizardHeader({ compact, title, cancelLabel, onCancel }: Props) {
  return (
    <header className="shrink-0 border-b border-white/5 bg-surface-container-low/30 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center gap-2 px-3 py-2.5 min-h-[48px]">
        <button
          type="button"
          onClick={onCancel}
          className={compact ? RECORDING_HEADER_BTN_BACK_MOBILE : RECORDING_HEADER_BTN_SECONDARY}
          title={cancelLabel}
          aria-label={cancelLabel}
        >
          <ArrowLeft size={16} className="shrink-0" />
          {!compact ? <span>{cancelLabel}</span> : null}
        </button>
        <h1
          className={compact ? 'text-sm font-bold truncate flex-1' : 'text-base font-bold truncate flex-1'}
        >
          {title}
        </h1>
      </div>
    </header>
  );
}
