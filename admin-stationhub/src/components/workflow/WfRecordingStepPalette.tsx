import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import {
  CHROME_STEP_PALETTE,
  actionLabel as chromeActionLabel,
  type ChromeScriptAction,
} from '@/src/lib/chromeScriptSteps';
import {
  DESKTOP_STEP_PALETTE,
  actionLabel as desktopActionLabel,
  type DesktopAction,
} from '@/src/lib/desktopRecordingSteps';
import { chromeActionIcon, desktopActionIcon } from '@/src/lib/recordingStepIcons';

type Props = {
  module: 'chrome' | 'desktop';
  compact?: boolean;
  onAddChromeStep?: (action: ChromeScriptAction) => void;
  onAddDesktopStep?: (action: DesktopAction) => void;
};

function StepButton({
  label,
  icon: Icon,
  compact,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  compact?: boolean;
  onClick: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        title={label}
        onClick={onClick}
        className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center text-primary"
      >
        <Icon size={16} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 hover:border-primary/30 text-left text-xs font-bold transition-all"
    >
      <Icon size={14} className="text-primary shrink-0" />
      <span className="truncate flex-1">{label}</span>
      <Plus size={12} className="opacity-40 shrink-0" />
    </button>
  );
}

export function WfRecordingStepPalette({
  module,
  compact,
  onAddChromeStep,
  onAddDesktopStep,
}: Props) {
  if (module === 'chrome') {
    const items = CHROME_STEP_PALETTE.map(({ action }) => ({
      action,
      label: chromeActionLabel(action),
      icon: chromeActionIcon(action),
    }));

    return (
      <div className={cn(compact ? 'flex flex-col gap-1' : 'space-y-1')}>
        {items.map((item) => (
          <div key={item.action}>
            <StepButton
              label={item.label}
              icon={item.icon}
              compact={compact}
              onClick={() => onAddChromeStep?.(item.action)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(compact ? 'flex flex-col gap-1' : 'space-y-1')}>
      {DESKTOP_STEP_PALETTE.map((action) => (
        <div key={action}>
          <StepButton
            label={desktopActionLabel(action)}
            icon={desktopActionIcon(action)}
            compact={compact}
            onClick={() => onAddDesktopStep?.(action)}
          />
        </div>
      ))}
    </div>
  );
}

export function WfRecordingStepPaletteLabel({ module }: { module: 'chrome' | 'desktop' }) {
  return (
    <p className="text-[9px] font-mono font-bold uppercase tracking-wide text-on-surface-variant/50 px-4 pb-1.5 pt-0.5">
      {module === 'chrome'
        ? t('workflows.paletteChromeSteps')
        : t('workflows.paletteDesktopSteps')}
    </p>
  );
}
