import type { ComponentType } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

export type WizardStepKey = 'agent' | 'meta' | 'config';

export type WizardStepItem = {
  key: WizardStepKey;
  label: string;
  Icon: ComponentType<{ size?: number }>;
};

type Props = {
  compact?: boolean;
  steps: WizardStepItem[];
  current: WizardStepKey;
  canGoTo: (key: WizardStepKey) => boolean;
  onSelect: (key: WizardStepKey) => void;
  agentName?: string;
  onChangeAgent?: () => void;
  changeAgentLabel?: string;
};

export function TaskTemplateWizardSteps({
  compact,
  steps,
  current,
  canGoTo,
  onSelect,
  agentName,
  onChangeAgent,
  changeAgentLabel,
}: Props) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  if (compact) {
    return (
      <nav className="shrink-0 border-b border-white/10 bg-surface-container-low/20">
        <div className="px-3 py-2 overflow-x-auto custom-scrollbar overscroll-x-contain">
          <div className="flex gap-2 w-max min-w-full">
            {steps.map((s, i) => {
              const enabled = canGoTo(s.key);
              const active = current === s.key;
              const done = i < currentIndex;
              return (
                <button
                  key={s.key}
                  type="button"
                  disabled={!enabled}
                  onClick={() => onSelect(s.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold border shrink-0 transition-colors',
                    active
                      ? 'border-primary/50 bg-primary/15 text-primary'
                      : done
                        ? 'border-tertiary/30 bg-tertiary/10 text-tertiary'
                        : 'border-white/10 text-on-surface-variant',
                    !enabled && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono',
                      active ? 'bg-primary text-on-primary' : 'bg-white/10',
                    )}
                  >
                    {done ? <Check size={12} /> : i + 1}
                  </span>
                  <span className="max-w-[6rem] truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {agentName && onChangeAgent ? (
          <div className="px-3 pb-2 flex items-center gap-2 text-xs border-t border-white/5 pt-2">
            <span className="text-on-surface-variant font-mono text-[10px] uppercase shrink-0">
              Agent
            </span>
            <span className="font-bold text-on-surface truncate flex-1">{agentName}</span>
            <button
              type="button"
              onClick={onChangeAgent}
              className="text-primary font-bold shrink-0"
            >
              {changeAgentLabel}
            </button>
          </div>
        ) : null}
      </nav>
    );
  }

  return (
    <nav className="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/10 px-1">
      <div className="flex flex-wrap gap-1 min-w-0">
        {steps.map((s) => {
          const enabled = canGoTo(s.key);
          const active = current === s.key;
          return (
            <button
              key={s.key}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(s.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface',
              )}
            >
              <s.Icon size={16} />
              {s.label}
            </button>
          );
        })}
      </div>
      {agentName && onChangeAgent ? (
        <div className="flex flex-wrap items-center gap-2 text-sm shrink-0 pb-1 pr-2">
          <span className="text-on-surface-variant font-mono text-[10px] uppercase">Agent</span>
          <span className="font-bold text-on-surface">{agentName}</span>
          <button
            type="button"
            onClick={onChangeAgent}
            className="text-primary text-xs font-bold hover:underline"
          >
            {changeAgentLabel}
          </button>
        </div>
      ) : null}
    </nav>
  );
}
