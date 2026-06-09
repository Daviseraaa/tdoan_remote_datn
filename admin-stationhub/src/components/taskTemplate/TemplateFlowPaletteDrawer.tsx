import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/src/lib/utils';

type Props = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Palette bước — drawer trái trên mobile. */
export function TemplateFlowPaletteDrawer({ title, open, onClose, children }: Props) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[45] bg-black/50" onClick={onClose} aria-hidden />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[46] w-[min(280px,88vw)] flex flex-col',
          'bg-surface-container-low border-r border-white/10 shadow-2xl',
          'pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
        )}
        role="dialog"
        aria-modal
        aria-label={title}
      >
        <div className="px-3 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-on-surface-variant"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 min-h-0">{children}</div>
      </aside>
    </>
  );
}
