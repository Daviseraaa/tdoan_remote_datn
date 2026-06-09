import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = agents.find((a) => a.id === value);

  const syncMenuPosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null);
      return;
    }
    syncMenuPosition();
    const onLayout = () => syncMenuPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if ((e.target as Element).closest?.('[data-wf-agent-menu]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (agentId: string) => {
    onChange(agentId);
    setOpen(false);
  };

  const menu =
    open && menuStyle
      ? createPortal(
          <ul
            data-wf-agent-menu
            style={{
              position: 'fixed',
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              zIndex: 9999,
            }}
            className={cn(
              'py-1.5 overflow-hidden',
              'rounded-xl border border-white/10 bg-surface-container-high shadow-2xl',
              'max-h-[min(220px,40dvh)] overflow-y-auto custom-scrollbar',
            )}
          >
            <li>
              <button
                type="button"
                onClick={() => pick('')}
                className={cn(
                  'w-full px-3 py-2.5 text-left text-xs text-on-surface-variant',
                  'hover:bg-white/8 transition-colors',
                  !value && 'bg-primary/10 text-primary font-bold',
                )}
              >
                {placeholder ?? t('workflows.selectDefaultAgent')}
              </button>
            </li>
            {agents.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-on-surface-variant">
                {t('workflows.noAgents')}
              </li>
            ) : (
              agents.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => pick(a.id)}
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
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={cn('relative', className)} title={title}>
      <button
        ref={buttonRef}
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
            <span className="text-on-surface-variant">
              {placeholder ?? t('workflows.selectDefaultAgent')}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-on-surface-variant transition-transform', open && 'rotate-180')}
        />
      </button>
      {menu}
    </div>
  );
}
