import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, ChevronRight, MessageCircle, PlayCircle, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/src/lib/utils';
import * as triggersApi from '@/src/api/triggers';
import { TriggerDetailDrawer } from '@/src/components/automations/TriggerDetailDrawer';
import { TriggersPanel } from '@/src/components/automations/TriggersPanel';
import { t } from '@/src/i18n/t';

export default function Automations() {
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: triggers, isLoading } = useQuery({
    queryKey: ['workflow-triggers'],
    queryFn: () => triggersApi.listTriggers(),
    refetchInterval: 15_000,
  });

  const list = triggers ?? [];

  const stats = useMemo(
    () => [
      {
        label: t('triggers.statsTotal'),
        value: list.length,
        icon: Zap,
        color: 'text-primary',
      },
      {
        label: t('triggers.statsEnabled'),
        value: list.filter((tr) => tr.enabled).length,
        icon: PlayCircle,
        color: 'text-tertiary',
      },
      {
        label: t('triggers.statsScheduled'),
        value: list.filter((tr) => tr.type === 'SCHEDULE').length,
        icon: CalendarClock,
        color: 'text-amber-400',
      },
      {
        label: t('triggers.statsTelegram'),
        value: list.filter((tr) => tr.type === 'TELEGRAM').length,
        icon: MessageCircle,
        color: 'text-sky-400',
      },
    ],
    [list],
  );

  return (
    <div className="pb-12 min-w-0 max-w-full space-y-6 sm:space-y-0">
      <header className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              {t('automations.title')}
            </h2>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-on-surface-variant border border-white/10 shrink-0">
              {t('automations.viewOnlyBadge')}
            </span>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed max-w-2xl">
            {t('automations.subtitleViewOnly')}
          </p>
        </div>
        <Link
          to="/workflows"
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-on-surface hover:bg-white/10 transition-colors shrink-0"
        >
          {t('triggers.openWorkflows')}
          <ChevronRight size={16} className="shrink-0" />
        </Link>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="glass-panel p-3.5 sm:p-5 rounded-2xl border-white/5 flex items-center gap-3 sm:gap-4 min-w-0"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant shrink-0">
              <Icon size={20} className={color} />
            </div>
            <div className="min-w-0">
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-widest block truncate">
                {label}
              </span>
              <span className={cn('text-xl sm:text-2xl font-black tabular-nums', color)}>{value}</span>
            </div>
          </div>
        ))}
      </section>

      <TriggersPanel
        triggers={list}
        loading={isLoading}
        onDetail={setDetailId}
      />

      <aside className="mt-8 sm:mt-10 p-4 sm:p-5 rounded-2xl bg-surface-container-high/30 border border-white/5">
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('triggers.viewOnlyHint')}
        </p>
      </aside>

      <TriggerDetailDrawer triggerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
