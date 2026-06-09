import React from 'react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { AgentCluster } from '@/src/lib/agentClusters';
import type { AgentStatus } from '@/src/types/api';

function statusDotClass(status: AgentStatus, online: boolean): string {
  if (online) {
    return status === 'BUSY' ? 'bg-amber-400' : 'bg-tertiary';
  }
  return 'bg-on-surface-variant/40';
}

type AgentResourceClusterListProps<T> = {
  clusters: AgentCluster<T>[];
  emptyClusterHint: string;
  getItemKey: (item: T) => string;
  renderItem: (item: T, cluster: AgentCluster<T>) => React.ReactNode;
};

export function AgentResourceClusterList<T>({
  clusters,
  emptyClusterHint,
  getItemKey,
  renderItem,
}: AgentResourceClusterListProps<T>) {
  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {clusters.map((cluster) => (
        <section
          key={cluster.agentId}
          className={cn(
            'rounded-2xl border overflow-hidden min-w-0',
            cluster.online ? 'border-primary/20 bg-primary/5' : 'border-white/5 bg-surface-container-low/30',
          )}
        >
          <header className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/5 bg-surface-container-low/50 min-w-0">
            <span
              className={cn('w-2.5 h-2.5 rounded-full shrink-0', statusDotClass(cluster.status, cluster.online))}
              aria-hidden
            />
            <h3 className="font-bold text-sm text-on-surface truncate min-w-0 max-w-[45%] sm:max-w-none">
              {cluster.agentName}
            </h3>
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0',
                cluster.online
                  ? cluster.status === 'BUSY'
                    ? 'bg-amber-500/15 text-amber-300'
                    : 'bg-tertiary/15 text-tertiary'
                  : 'bg-white/5 text-on-surface-variant',
              )}
            >
              {t(`status.${cluster.status}` as 'status.ONLINE')}
            </span>
            <span className="text-xs text-on-surface-variant ml-auto shrink-0 tabular-nums">
              {cluster.items.length} {t('agentClusters.items')}
            </span>
          </header>

          {cluster.items.length === 0 ? (
            <p className="px-3 sm:px-4 py-5 sm:py-6 text-sm text-on-surface-variant text-center">
              {emptyClusterHint}
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {cluster.items.map((item) => (
                <React.Fragment key={getItemKey(item)}>{renderItem(item, cluster)}</React.Fragment>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
