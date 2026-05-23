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
    <div className="pb-12 max-w-[1400px]">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-bold tracking-tight text-on-surface">
                {t('automations.title')}
              </h2>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/5 text-on-surface-variant border border-white/10">
                {t('automations.viewOnlyBadge')}
              </span>
            </div>
            <p className="text-on-surface-variant text-sm leading-relaxed max-w-2xl">
              {t('automations.subtitleViewOnly')}
            </p>
          </div>
          <Link
            to="/workflows"
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-on-surface hover:bg-white/10 transition-colors shrink-0"
          >
            {t('triggers.openWorkflows')}
            <ChevronRight size={16} />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="glass-panel p-5 rounded-2xl border-white/5 flex items-center gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <Icon size={22} className={color} />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-widest block">
                {label}
              </span>
              <span className={cn('text-2xl font-black tabular-nums', color)}>{value}</span>
            </div>
          </div>
        ))}
      </section>

      <TriggersPanel
        triggers={list}
        loading={isLoading}
        onDetail={setDetailId}
      />

      <aside className="mt-10 p-5 rounded-2xl bg-surface-container-high/30 border border-white/5">
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('triggers.viewOnlyHint')}
        </p>
      </aside>

      <TriggerDetailDrawer triggerId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
