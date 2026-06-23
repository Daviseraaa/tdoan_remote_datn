import type { ReactNode } from 'react';
import { t } from '@/src/i18n/t';

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10 font-mono text-[10px] text-on-surface font-bold">
      {children}
    </kbd>
  );
}

export function WfEditorShortcutsHint() {
  return (
    <div className="pointer-events-none select-none flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-surface-container-high/90 border border-white/10 text-[10px] text-on-surface-variant max-w-[min(100vw-2rem,28rem)]">
      <span className="flex items-center gap-1.5">
        <Kbd>Delete</Kbd>
        <span className="text-on-surface-variant/60">/</span>
        <Kbd>Backspace</Kbd>
        <span>{t('workflows.shortcuts.delete')}</span>
      </span>
      <span className="hidden sm:inline text-white/15" aria-hidden>
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Alt</Kbd>
        <span>{t('workflows.shortcuts.multiSelect')}</span>
      </span>
      <span className="hidden sm:inline text-white/15" aria-hidden>
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Ctrl</Kbd>
        <span className="text-on-surface-variant/60">+</span>
        <Kbd>C</Kbd>
        <span>{t('workflows.shortcuts.copy')}</span>
      </span>
      <span className="hidden sm:inline text-white/15" aria-hidden>
        ·
      </span>
      <span className="flex items-center gap-1.5">
        <Kbd>Ctrl</Kbd>
        <span className="text-on-surface-variant/60">+</span>
        <Kbd>V</Kbd>
        <span>{t('workflows.shortcuts.paste')}</span>
      </span>
    </div>
  );
}
