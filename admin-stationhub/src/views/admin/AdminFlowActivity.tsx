import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, Filter } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import * as adminApi from '@/src/api/admin';
import { Pagination } from '@/src/components/Pagination';
import { useAdminQueryEnabled } from '@/src/hooks/useAdminQueryEnabled';
import { queryKeys } from '@/src/lib/queryKeys';
import { t } from '@/src/i18n/t';

const PAGE = 25;

const CHANNELS = ['', 'MANUAL', 'SCHEDULE', 'TELEGRAM'] as const;
const STATUSES = ['', 'RUNNING', 'COMPLETED', 'FAILED', 'PENDING', 'CANCELLED'] as const;

function channelLabel(type: string | null): string {
  switch (type) {
    case 'MANUAL':
      return t('adminPortal.channelManual');
    case 'SCHEDULE':
      return t('adminPortal.channelSchedule');
    case 'TELEGRAM':
      return t('adminPortal.channelTelegram');
    default:
      return t('adminPortal.channelUnknown');
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'text-tertiary';
    case 'FAILED':
      return 'text-error';
    case 'RUNNING':
      return 'text-primary';
    default:
      return 'text-on-surface-variant';
  }
}

export default function AdminFlowActivity() {
  const adminEnabled = useAdminQueryEnabled();
  const [page, setPage] = useState(1);
  const [triggerType, setTriggerType] = useState<(typeof CHANNELS)[number]>('');
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.adminWorkflowRuns({
      page,
      limit: PAGE,
      triggerType: triggerType || undefined,
      status: status || undefined,
    }),
    queryFn: () =>
      adminApi.listAdminWorkflowRuns({
        page,
        limit: PAGE,
        triggerType: triggerType || undefined,
        status: status || undefined,
      }),
    enabled: adminEnabled,
    refetchInterval: adminEnabled ? 20_000 : false,
  });

  const rows = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitBranch className="text-primary" />
          {t('adminPortal.flowsTitle')}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1 prose-description">{t('adminPortal.flowsSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-on-surface-variant" />
          <span className="text-xs font-bold text-on-surface-variant uppercase">{t('adminPortal.channel')}</span>
          {CHANNELS.map((c) => (
            <button
              key={c || 'all'}
              type="button"
              onClick={() => {
                setTriggerType(c);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold',
                triggerType === c ? 'bg-primary text-on-primary' : 'bg-white/5',
              )}
            >
              {c ? channelLabel(c) : t('common.all')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-on-surface-variant uppercase">{t('common.status')}</span>
          {STATUSES.map((s) => (
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
      </div>

      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-widest text-on-surface-variant">
                <th className="p-4">{t('adminPortal.flowTime')}</th>
                <th className="p-4">{t('adminPortal.owner')}</th>
                <th className="p-4">{t('adminPortal.workflow')}</th>
                <th className="p-4">{t('adminPortal.channel')}</th>
                <th className="p-4">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : null}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-on-surface-variant">
                    {t('adminPortal.noRuns')}
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-xs font-mono whitespace-nowrap">
                    {new Date(r.startedAt).toLocaleString('vi-VN')}
                  </td>
                  <td className="p-4">
                    <p className="font-medium">{r.user.name}</p>
                    <p className="text-xs font-mono text-on-surface-variant">{r.user.email}</p>
                  </td>
                  <td className="p-4">
                    <p className="font-bold">{r.workflow.name}</p>
                    {!r.workflow.isActive ? (
                      <span className="text-[10px] text-on-surface-variant">{t('adminPortal.workflowOff')}</span>
                    ) : null}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-lg bg-white/5 text-xs font-bold">
                      {channelLabel(r.triggerType)}
                    </span>
                  </td>
                  <td className={cn('p-4 font-bold text-xs', statusClass(r.status))}>{r.status}</td>
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
