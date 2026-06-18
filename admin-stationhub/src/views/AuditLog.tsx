import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Calendar,
  ChevronDown,
  User,
  Fingerprint,
  History,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAuditLogs } from '@/src/hooks/useAudit';
import { mapAuditToLogRow } from '@/src/lib/mappers';
import { Pagination } from '@/src/components/Pagination';
import { t, type TranslationKey } from '@/src/i18n/t';

const PAGE = 20;

const AUDIT_CATEGORIES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'All Categories', labelKey: 'audit.allCategories' },
  { value: 'Security', labelKey: 'audit.security' },
  { value: 'System', labelKey: 'audit.system' },
  { value: 'Auth', labelKey: 'audit.auth' },
  { value: 'Automation', labelKey: 'audit.automation' },
];

const DATE_RANGES: { value: string; labelKey: TranslationKey }[] = [
  { value: 'All Time', labelKey: 'audit.dateAllTime' },
  { value: 'Last 24h', labelKey: 'audit.dateLast24h' },
  { value: 'Last 7 Days', labelKey: 'audit.dateLast7d' },
  { value: 'Last 30 Days', labelKey: 'audit.dateLast30d' },
];

function severityLabel(sev: string): string {
  if (sev === 'INFO') return t('audit.severityInfo');
  if (sev === 'WARNING') return t('audit.severityWarning');
  if (sev === 'CRITICAL') return t('audit.severityCritical');
  return sev;
}

function categoryQuery(category: string): {
  resource?: string;
  resourceIn?: string;
} {
  switch (category) {
    case 'Auth':
      return { resource: 'auth' };
    case 'Security':
      return { resourceIn: 'user,agent' };
    case 'System':
      return { resourceIn: 'plan,task' };
    case 'Automation':
      return { resource: 'workflow' };
    default:
      return {};
  }
}

function dateRangeQuery(range: string): { from?: string; to?: string } {
  if (range === 'All Time') return {};
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const days =
    range === 'Last 24h' ? 1 : range === 'Last 7 Days' ? 7 : range === 'Last 30 Days' ? 30 : 0;
  if (!days) return {};
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: fromDate.toISOString(),
    to,
  };
}

type LogRow = ReturnType<typeof mapAuditToLogRow>;

const LogEntry = ({
  id,
  time,
  date,
  status,
  title,
  actor,
  target,
  payload,
  detail,
}: LogRow) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex flex-col sm:flex-row gap-3 sm:gap-6 lg:gap-10 group relative pb-8 sm:pb-10 min-w-0"
  >
    <div className="relative z-10 flex sm:block items-center gap-2 sm:w-20 shrink-0">
      <div className="font-mono text-[11px] text-on-surface-variant font-bold sm:pt-2">{time}</div>
      <div
        className={cn(
          'w-2 h-2 rounded-full border-2 border-surface z-10 shrink-0',
          'sm:absolute sm:left-[84px] sm:top-2.5',
          status === 'CRITICAL'
            ? 'bg-error shadow-[0_0_10px_#ffb4ab]'
            : status === 'WARNING'
              ? 'bg-tertiary shadow-[0_0_10px_#68f5b8]'
              : 'bg-primary shadow-[0_0_10px_#a4e6ff]',
        )}
      />
      {date ? (
        <span className="sm:hidden text-[10px] font-mono text-on-surface-variant/60">{date}</span>
      ) : null}
    </div>

    <div className="flex-1 min-w-0 glass-card p-4 sm:p-6 rounded-2xl hover:bg-white/[0.07] transition-all cursor-default group-hover:border-white/20">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h4 className="font-bold text-on-surface break-words">{title}</h4>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0',
                status === 'CRITICAL'
                  ? 'bg-error-container/20 text-error border-error/20'
                  : status === 'WARNING'
                    ? 'bg-tertiary-container/10 text-tertiary border-tertiary/20'
                    : 'bg-primary-container/10 text-primary border-primary/20',
              )}
            >
              {severityLabel(status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-on-surface-variant leading-none">
            <div className="flex items-center gap-1.5 min-w-0">
              <User size={12} className="shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-none">{actor}</span>
            </div>
            <span className="opacity-20 hidden sm:inline">|</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <History size={12} className="shrink-0" />
              <span className="truncate">{t('audit.target', { target })}</span>
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col sm:items-end justify-between sm:justify-start gap-2 shrink-0">
          <span className="font-mono text-[9px] text-on-surface-variant opacity-40 hidden sm:block">
            ID: {id.slice(0, 8)}
          </span>
          <button
            type="button"
            className="p-1 hover:bg-white/5 rounded transition-all text-on-surface-variant hover:text-on-surface"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {payload ? (
        <div className="bg-surface-container-lowest/50 rounded-xl p-3 sm:p-4 border border-white/5 font-mono text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed mb-4 overflow-x-auto break-all">
          {payload}
        </div>
      ) : null}

      {detail ? (
        <p className="text-xs text-on-surface-variant leading-relaxed opacity-80 break-words">
          {detail}
        </p>
      ) : null}
    </div>
  </motion.div>
);

export default function AuditLog() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [dateRange, setDateRange] = useState('All Time');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, dateRange]);

  const categoryFilter = useMemo(() => categoryQuery(selectedCategory), [selectedCategory]);
  const dateFilter = useMemo(() => dateRangeQuery(dateRange), [dateRange]);

  const { data: auditPage, isLoading } = useAuditLogs({
    page,
    limit: PAGE,
    actor: debouncedSearch || undefined,
    ...categoryFilter,
    ...dateFilter,
  });

  const logs = useMemo(
    () => (auditPage?.items ?? []).map(mapAuditToLogRow),
    [auditPage],
  );

  const severities = ['INFO', 'WARNING', 'CRITICAL'];

  const filteredLogs = useMemo(() => {
    if (selectedSeverities.length === 0) return logs;
    return logs.filter((log) => selectedSeverities.includes(log.status));
  }, [logs, selectedSeverities]);

  const toggleSeverity = (sev: string) => {
    setSelectedSeverities((prev) =>
      prev.includes(sev) ? prev.filter((s) => s !== sev) : [...prev, sev],
    );
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedSeverities([]);
    setSelectedCategory('All Categories');
    setDateRange('All Time');
    setPage(1);
  };

  const meta = auditPage?.meta;
  const total = meta?.total ?? 0;

  return (
    <div className="w-full max-w-6xl mx-auto pb-20 min-w-0">
      <div className="mb-8 sm:mb-10">
        <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">
          {t('audit.title')}
        </h2>
        <p className="prose-description text-on-surface-variant text-body-md mt-2">
          {t('audit.subtitle')}
        </p>
      </div>

      <div className="glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-8 sm:mb-12 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 pointer-events-none">
          <Fingerprint size={80} className="sm:w-[120px] sm:h-[120px]" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="sm:col-span-2 space-y-2 min-w-0">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">
              {t('audit.searchLabel')}
            </label>
            <div className="relative group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors"
                size={18}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('audit.searchPlaceholder')}
                className="w-full bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant/30 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">
              {t('audit.category')}
            </label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 px-5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary/40 transition-all"
              >
                {AUDIT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-surface">
                    {t(cat.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                size={16}
              />
            </div>
          </div>

          <div className="space-y-2 min-w-0">
            <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.2em] ml-1">
              {t('audit.timeHorizon')}
            </label>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full appearance-none bg-surface-container-highest/50 border border-white/5 rounded-2xl py-3.5 px-5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary/40 transition-all"
              >
                {DATE_RANGES.map((range) => (
                  <option key={range.value} value={range.value} className="bg-surface">
                    {t(range.labelKey)}
                  </option>
                ))}
              </select>
              <Calendar
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
                size={16}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant/60 uppercase tracking-widest shrink-0">
              {t('audit.severity')}:
            </span>
            <div className="flex flex-wrap gap-2">
              {severities.map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => toggleSeverity(sev)}
                  className={cn(
                    'px-4 py-1.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-2',
                    selectedSeverities.includes(sev)
                      ? sev === 'CRITICAL'
                        ? 'bg-error/20 border-error/40 text-error'
                        : sev === 'WARNING'
                          ? 'bg-tertiary/20 border-tertiary/40 text-tertiary'
                          : 'bg-primary/20 border-primary/40 text-primary'
                      : 'bg-white/5 border-white/10 text-on-surface-variant hover:border-white/20',
                  )}
                >
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      sev === 'CRITICAL'
                        ? 'bg-error'
                        : sev === 'WARNING'
                          ? 'bg-tertiary'
                          : 'bg-primary',
                      !selectedSeverities.includes(sev) && 'opacity-40',
                    )}
                  />
                  {severityLabel(sev)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:justify-end">
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-2 text-[10px] font-bold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <X size={14} />
              {t('audit.resetFilters')}
            </button>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <p className="text-[10px] font-mono font-bold text-primary uppercase tracking-[0.1em]">
              {t('audit.matchesFound', { n: filteredLogs.length })}
            </p>
          </div>
        </div>
      </div>

      <div className="relative min-h-[400px] min-w-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-on-surface-variant text-sm">
            {t('common.loading')}
          </div>
        ) : filteredLogs.length > 0 ? (
          <>
            <div className="absolute left-[87.5px] top-4 bottom-0 w-[1px] bg-white/5 hidden sm:block" />
            <AnimatePresence mode="popLayout">
              {filteredLogs.map((log) => (
                <LogEntry key={log.id} {...log} />
              ))}
            </AnimatePresence>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 bg-white/2 rounded-3xl border border-dashed border-white/10"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant/30 mb-4">
              <Search size={32} />
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">{t('audit.noLogs')}</h3>
            <p className="text-on-surface-variant text-sm text-center max-w-xs">
              {t('audit.noLogsHint')}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 px-6 py-2.5 bg-primary text-on-primary rounded-xl font-bold hover:scale-105 active:scale-95 transition-all text-xs"
            >
              {t('audit.clearFilters')}
            </button>
          </motion.div>
        )}
      </div>

      {meta ? (
        <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/5">
          <Pagination page={page} limit={PAGE} total={total} onPageChange={setPage} />
        </div>
      ) : null}
    </div>
  );
}
