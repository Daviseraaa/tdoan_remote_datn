import type { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

type Props = {
  compact?: boolean;
  children: ReactNode;
};

export function TaskTemplateWizardFooter({ compact, children }: Props) {
  return (
    <div
      className={cn(
        'shrink-0 flex flex-wrap items-center gap-3 border-t border-white/10 bg-surface-container-low/95 backdrop-blur-md',
        compact
          ? 'px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]'
          : 'pt-4 mt-auto px-1 pb-1',
      )}
    >
      {children}
    </div>
  );
}
