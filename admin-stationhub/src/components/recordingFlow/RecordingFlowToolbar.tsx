import type { ReactNode } from 'react';
import { cn } from '@/src/lib/utils';

type Props = {
  compact?: boolean;
  children: ReactNode;
};

/** Toolbar hành động — desktop wrap, mobile cuộn ngang một hàng. */
export function RecordingFlowToolbar({ compact, children }: Props) {
  if (!compact) {
    return (
      <div className="px-3 pb-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2">
        {children}
      </div>
    );
  }

  return (
    <div className="border-t border-white/5 pt-2 pb-2 px-3">
      <div className="-mx-3 px-3 overflow-x-auto custom-scrollbar overscroll-x-contain">
        <div className="flex items-center gap-2 w-max min-w-full pb-1">{children}</div>
      </div>
    </div>
  );
}
