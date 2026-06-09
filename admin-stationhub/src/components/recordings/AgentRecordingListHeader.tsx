import type { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { t } from '@/src/i18n/t';

type Props = {
  title: string;
  subtitle: ReactNode;
  onlineCount: number;
  syncing: boolean;
  syncLabel: string;
  onSync: () => void;
  onRetry: () => void;
};

/** Header danh sách chrome-scripts / desktop-recordings — responsive mobile. */
export function AgentRecordingListHeader({
  title,
  subtitle,
  onlineCount,
  syncing,
  syncLabel,
  onSync,
  onRetry,
}: Props) {
  return (
    <header className="mb-6 sm:mb-8 flex flex-col gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">{title}</h2>
        <p className="prose-description text-on-surface-variant text-sm sm:text-body-md mt-1">
          {subtitle}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full sm:flex-row sm:flex-wrap sm:items-center sm:w-auto sm:ml-auto">
        {onlineCount > 0 ? (
          <span className="inline-flex items-center justify-center sm:justify-start px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white/5 text-xs sm:text-sm font-bold text-tertiary w-full sm:w-auto">
            {t('agentClusters.onlineCount', { count: String(onlineCount) })}
          </span>
        ) : null}
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing || onlineCount === 0}
            className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs sm:text-sm font-bold disabled:opacity-50 min-w-0"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin shrink-0' : 'shrink-0'} />
            <span className="truncate">{syncLabel}</span>
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs sm:text-sm font-bold shrink-0"
          >
            {t('common.retry')}
          </button>
        </div>
      </div>
    </header>
  );
}
