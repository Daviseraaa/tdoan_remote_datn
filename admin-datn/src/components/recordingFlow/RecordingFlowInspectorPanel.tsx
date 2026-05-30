import type { ReactNode } from 'react';
import { Eye, X } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

type Props = {
  open: boolean;
  compact?: boolean;
  title: string;
  onClose: () => void;
  metaContent?: ReactNode;
  readOnlyHint?: string;
  children: ReactNode;
};

export function RecordingFlowInspectorPanel({
  open,
  compact,
  title,
  onClose,
  metaContent,
  readOnlyHint,
  children,
}: Props) {
  if (!open) return null;

  if (compact) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden
        />
        <aside
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[88dvh]',
            'rounded-t-2xl border-t border-white/10 bg-surface-container-low shadow-2xl',
            'pb-[env(safe-area-inset-bottom,0px)]',
          )}
          role="dialog"
          aria-modal
          aria-label={title}
        >
          <div className="flex justify-center pt-2 pb-1 shrink-0">
            <span className="w-10 h-1 rounded-full bg-white/20" aria-hidden />
          </div>
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
            <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-on-surface-variant"
              aria-label={t('common.cancel')}
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 min-h-0">
            {metaContent}
            {readOnlyHint ? (
              <p className="text-xs text-on-surface-variant flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
                <Eye size={14} className="shrink-0 text-primary mt-0.5" />
                {readOnlyHint}
              </p>
            ) : null}
            {children}
          </div>
        </aside>
      </>
    );
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-20 w-[min(400px,40vw)] border-l border-white/5 bg-surface-container-low/95 flex flex-col backdrop-blur-md shadow-[-8px_0_24px_rgba(0,0,0,0.2)]">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white/5 text-on-surface-variant"
          title={t('common.cancel')}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4 min-h-0">
        {metaContent}
        {readOnlyHint ? (
          <p className="text-xs text-on-surface-variant flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <Eye size={14} className="shrink-0 text-primary mt-0.5" />
            {readOnlyHint}
          </p>
        ) : null}
        {children}
      </div>
    </aside>
  );
}
