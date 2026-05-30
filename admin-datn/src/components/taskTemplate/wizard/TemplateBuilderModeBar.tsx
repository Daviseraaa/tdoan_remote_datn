import type { ComponentType, ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

type ModeBtn = {
  id: string;
  label: string;
  Icon: ComponentType<{ size?: number }>;
  active: boolean;
  onClick: () => void;
};

type Props = {
  compact?: boolean;
  modes: ModeBtn[];
  trailing?: ReactNode;
};

export function TemplateBuilderModeBar({ compact, modes, trailing }: Props) {
  const btn = (m: ModeBtn) => (
    <button
      key={m.id}
      type="button"
      onClick={m.onClick}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0',
        m.active
          ? 'border-primary/50 bg-primary/15 text-primary'
          : 'border-white/10 text-on-surface-variant hover:bg-white/5',
      )}
    >
      <m.Icon size={14} />
      {m.label}
    </button>
  );

  if (!compact) {
    return (
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {modes.map(btn)}
        {trailing}
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-2">
      <div className="overflow-x-auto custom-scrollbar overscroll-x-contain -mx-1 px-1">
        <div className="flex gap-2 w-max min-w-full">{modes.map(btn)}</div>
      </div>
      {trailing ? <div className="flex flex-wrap gap-2">{trailing}</div> : null}
    </div>
  );
}
