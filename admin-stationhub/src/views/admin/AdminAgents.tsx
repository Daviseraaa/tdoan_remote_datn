import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Cpu } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as agentsApi from '@/src/api/agents';
import { Pagination } from '@/src/components/Pagination';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';
import { t } from '@/src/i18n/t';
import type { AgentStatus } from '@/src/types/api';

const PAGE = 20;

function statusColor(s: AgentStatus): string {
  switch (s) {
    case 'ONLINE':
      return 'bg-tertiary/20 text-tertiary';
    case 'BUSY':
      return 'bg-primary/20 text-primary';
    default:
      return 'bg-white/10 text-on-surface-variant';
  }
}

export default function AdminAgents() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AgentStatus | ''>('');
  const adminEnabled = useAdminQueryEnabled();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.agents(true, { page, limit: PAGE, status: status || undefined }),
    queryFn: () =>
      agentsApi.listAgents(true, {
        page,
        limit: PAGE,
        status: status || undefined,
      }),
    enabled: adminEnabled,
    refetchInterval: adminEnabled ? 15_000 : false,
  });

  const agents = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Cpu className="text-primary" />
          {t('adminPortal.agentsTitle')}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">{t('adminPortal.agentsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['', 'ONLINE', 'OFFLINE', 'BUSY'] as const).map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-bold',
              status === s ? 'bg-primary text-on-primary' : 'bg-white/5',
            )}
          >
            {s || t('common.all')}
          </button>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="p-4">{t('adminPortal.agentName')}</th>
                <th className="p-4">{t('adminPortal.owner')}</th>
                <th className="p-4">{t('common.status')}</th>
                <th className="p-4">OS / Host</th>
                <th className="p-4">IP</th>
                <th className="p-4">{t('adminPortal.lastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : null}
              {!isLoading && agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">
                    {t('adminPortal.noAgents')}
                  </td>
                </tr>
              ) : null}
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 font-bold">{a.name}</td>
                  <td className="p-4">
                    <p className="font-medium">{a.user?.name ?? '—'}</p>
                    <p className="text-xs font-mono text-on-surface-variant">{a.user?.email}</p>
                  </td>
                  <td className="p-4">
                    <span className={cn('px-2 py-1 rounded-lg text-[10px] font-bold', statusColor(a.status))}>
                      {a.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-mono">
                    {a.os ?? '—'}
                    <br />
                    {a.hostname ?? '—'}
                  </td>
                  <td className="p-4 font-mono text-xs">{a.ip ?? '—'}</td>
                  <td className="p-4 text-xs text-on-surface-variant">
                    {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {meta ? (
          <div className="p-4 border-t border-white/5">
            <Pagination
              page={page}
              limit={PAGE}
              total={meta.total}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
