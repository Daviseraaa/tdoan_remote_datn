import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { Agent, AgentStatus } from '@/src/types/api';

function statusClass(status: AgentStatus): string {
  switch (status) {
    case 'ONLINE':
      return 'text-tertiary';
    case 'BUSY':
      return 'text-amber-400';
    default:
      return 'text-on-surface-variant';
  }
}

type Props = {
  value: string;
  onChange: (agentId: string) => void;
  agents: Agent[];
  placeholder?: string;
  className?: string;
  title?: string;
};

export function WfAgentSelect({
  value,
  onChange,
  agents,
  placeholder,
  className,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = agents.find((a) => a.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={cn('relative', className)} title={title}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium',
          'bg-surface-container-high border border-white/10 text-on-surface',
          'hover:border-primary/30 hover:bg-surface-container-high/90 transition-colors',
          open && 'border-primary/40 ring-1 ring-primary/20',
        )}
      >
        <span className="truncate text-left">
          {selected ? (
            <>
              <span className="font-bold">{selected.name}</span>
              <span className={cn('ml-1.5 font-mono text-[10px]', statusClass(selected.status))}>
                · {selected.status}
              </span>
            </>
          ) : (
            <span className="text-on-surface-variant">{placeholder ?? t('workflows.selectDefaultAgent')}</span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-on-surface-variant transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <ul
          className={cn(
            'absolute z-[60] left-0 right-0 mt-1.5 py-1.5 overflow-hidden',
            'rounded-xl border border-white/10 bg-surface-container-high shadow-2xl',
            'max-h-[220px] overflow-y-auto custom-scrollbar',
          )}
        >
          <li>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={cn(
                'w-full px-3 py-2.5 text-left text-xs text-on-surface-variant',
                'hover:bg-white/8 transition-colors',
                !value && 'bg-primary/10 text-primary font-bold',
              )}
            >
              {placeholder ?? t('workflows.selectDefaultAgent')}
            </button>
          </li>
          {agents.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/8',
                  value === a.id && 'bg-primary/15 font-bold',
                )}
              >
                <span className="text-on-surface">{a.name}</span>
                <span className={cn('ml-1.5 font-mono text-[10px]', statusClass(a.status))}>
                  · {a.status}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
