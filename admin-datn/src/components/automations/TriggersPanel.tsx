import { useMemo, useState } from 'react';
import {
  CalendarClock,
  ChevronRight,
  Loader2,
  MessageCircle,
  PlayCircle,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WorkflowTrigger, WorkflowTriggerType } from '@/src/api/triggers';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

type FilterId = 'all' | 'enabled' | 'disabled' | WorkflowTriggerType;

function formatTriggerType(type: string) {
  if (type === 'SCHEDULE') return t('triggers.typeSchedule');
  if (type === 'TELEGRAM') return t('triggers.typeTelegram');
  return t('triggers.typeManual');
}

function formatDateTime(iso?: string | null) {
  if (!iso) return t('common.emDash');
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const RUN_STATUS_KEYS = [
  'triggers.runStatus_COMPLETED',
  'triggers.runStatus_FAILED',
  'triggers.runStatus_RUNNING',
  'triggers.runStatus_PENDING',
  'triggers.runStatus_CANCELLED',
] as const;

function formatRunStatus(status?: string | null) {
  if (!status) return null;
  const key = `triggers.runStatus_${status}` as (typeof RUN_STATUS_KEYS)[number];
  if (RUN_STATUS_KEYS.includes(key)) return t(key);
  return status;
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'SCHEDULE') return <CalendarClock size={20} className="text-amber-400" />;
  if (type === 'TELEGRAM') return <MessageCircle size={20} className="text-sky-400" />;
  return <PlayCircle size={20} className="text-on-surface-variant" />;
}

type Props = {
  triggers: WorkflowTrigger[];
  loading: boolean;
  onDetail: (id: string) => void;
};

export function TriggersPanel({ triggers, loading, onDetail }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterId>('all');

  const filters: { id: FilterId; label: string }[] = [
    { id: 'all', label: t('triggers.filterAll') },
    { id: 'enabled', label: t('triggers.filterEnabled') },
    { id: 'disabled', label: t('triggers.filterDisabled') },
    { id: 'SCHEDULE', label: t('triggers.typeSchedule') },
    { id: 'TELEGRAM', label: t('triggers.typeTelegram') },
    { id: 'MANUAL', label: t('triggers.typeManual') },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return triggers.filter((tr) => {
      if (filter === 'enabled' && !tr.enabled) return false;
      if (filter === 'disabled' && tr.enabled) return false;
      if (filter !== 'all' && filter !== 'enabled' && filter !== 'disabled' && tr.type !== filter) {
        return false;
      }
      if (!q) return true;
      const hay = [
        tr.name,
        tr.workflow.name,
        tr.type,
        tr.telegramBot?.botUsername,
        tr.telegramBot?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [triggers, search, filter]);

  return (
    <section className="min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 mb-4 sm:mb-5">
        <div className="relative flex-1 min-w-0 w-full sm:max-w-md">
          <Search
            size={18}
            className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('triggers.searchPlaceholder')}
            className="w-full pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <p className="text-xs text-on-surface-variant shrink-0 px-0.5 sm:px-0">
          {t('triggers.resultCount', { count: filtered.length, total: triggers.length })}
        </p>
      </div>

      <div className="-mx-1 mb-5 sm:mb-6 overflow-x-auto custom-scrollbar overscroll-x-contain">
        <div className="flex gap-2 w-max min-w-full pb-0.5 px-1">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors border shrink-0 whitespace-nowrap',
                filter === f.id
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-on-surface-variant">
          <Loader2 size={22} className="animate-spin text-primary" />
          <span className="text-sm">{t('triggers.loading')}</span>
        </div>
      ) : null}

      {!loading && triggers.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-8 sm:p-12 text-center">
          <CalendarClock size={40} className="mx-auto mb-4 text-on-surface-variant/50" />
          <p className="text-on-surface font-medium mb-2">{t('triggers.emptyViewOnly')}</p>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto mb-6">
            {t('triggers.emptyViewOnlyDesc')}
          </p>
          <Link
            to="/workflows"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/20 text-primary text-sm font-bold hover:bg-primary/30"
          >
            {t('triggers.openWorkflows')}
            <ChevronRight size={16} />
          </Link>
        </div>
      ) : null}

      {!loading && triggers.length > 0 && filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-8 sm:p-10 text-center">
          <p className="text-on-surface-variant text-sm">{t('triggers.noResults')}</p>
        </div>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((tr) => (
            <li key={tr.id}>
              <TriggerCard trigger={tr} onOpen={() => onDetail(tr.id)} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function TriggerCard({
  trigger: tr,
  onOpen,
}: {
  trigger: WorkflowTrigger;
  onOpen: () => void;
}) {
  const lastStatus = formatRunStatus(tr.lastRunStatus);
  const displayName = tr.name?.trim() || tr.workflow.name;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left glass-card rounded-2xl p-4 sm:p-5 border border-white/5 hover:border-primary/25 hover:bg-white/[0.04] active:bg-white/[0.04] transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-surface-container-high border border-white/5 flex items-center justify-center shrink-0">
          <TypeIcon type={tr.type} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
            {displayName}
          </h3>
          {tr.name ? (
            <p className="text-xs text-on-surface-variant truncate mt-0.5">{tr.workflow.name}</p>
          ) : null}
        </div>
        <ChevronRight
          size={18}
          className="text-on-surface-variant/50 group-hover:text-primary shrink-0 mt-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-white/5 text-on-surface-variant border border-white/10">
          {formatTriggerType(tr.type)}
        </span>
        <span
          className={cn(
            'px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border',
            tr.enabled
              ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
              : 'bg-white/5 text-on-surface-variant border-white/10',
          )}
        >
          {tr.enabled ? t('triggers.enabled') : t('triggers.disabled')}
        </span>
        {tr.workflow.isActive === false ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-error/10 text-error border border-error/20">
            {t('triggers.workflowInactiveShort')}
          </span>
        ) : null}
      </div>

      <dl className="space-y-2 text-xs">
        {tr.type === 'SCHEDULE' ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
            <dt className="text-on-surface-variant shrink-0">{t('triggers.colNext')}</dt>
            <dd className="font-mono text-on-surface sm:text-right break-all">
              {formatDateTime(tr.nextRunAt)}
            </dd>
          </div>
        ) : null}
        {tr.type === 'TELEGRAM' && tr.telegramBot?.botUsername ? (
          <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
            <dt className="text-on-surface-variant shrink-0">{t('triggers.botLabel')}</dt>
            <dd className="font-mono text-sky-400 sm:text-right break-all">
              @{tr.telegramBot.botUsername}
            </dd>
          </div>
        ) : null}
        <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-2">
          <dt className="text-on-surface-variant shrink-0">{t('triggers.colLast')}</dt>
          <dd className="font-mono text-on-surface sm:text-right break-all">
            {formatDateTime(tr.lastRunAt)}
            {lastStatus ? (
              <span
                className={cn(
                  'block mt-0.5 text-[10px] font-sans font-semibold',
                  tr.lastRunStatus === 'FAILED' ? 'text-error' : 'text-tertiary',
                )}
              >
                {lastStatus}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="mt-3 sm:mt-4 text-[11px] text-primary/80 font-medium lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        {t('triggers.tapForDetail')}
      </p>
    </button>
  );
}
