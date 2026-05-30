import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarClock,
  ExternalLink,
  Loader2,
  MessageCircle,
  PlayCircle,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import * as triggersApi from '@/src/api/triggers';
import { parseMatchConfig } from '@/src/lib/triggerForm';
import { cn } from '@/src/lib/utils';
import { t, type TranslationKey } from '@/src/i18n/t';

type Props = {
  triggerId: string | null;
  onClose: () => void;
};

function formatDt(iso?: string | null) {
  if (!iso) return t('common.emDash');
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatTriggerType(type: string) {
  if (type === 'SCHEDULE') return t('triggers.typeSchedule');
  if (type === 'TELEGRAM') return t('triggers.typeTelegram');
  return t('triggers.typeManual');
}

const RUN_STATUS_KEYS = [
  'triggers.runStatus_COMPLETED',
  'triggers.runStatus_FAILED',
  'triggers.runStatus_RUNNING',
  'triggers.runStatus_PENDING',
  'triggers.runStatus_CANCELLED',
] as const;

function formatRunStatus(status: string) {
  const key = `triggers.runStatus_${status}` as (typeof RUN_STATUS_KEYS)[number];
  if (RUN_STATUS_KEYS.includes(key)) return t(key);
  return status;
}

function formatScheduleKind(kind?: string | null) {
  if (!kind) return t('common.emDash');
  const map: Record<string, TranslationKey> = {
    DAILY: 'triggers.scheduleKind_DAILY',
    CRON: 'triggers.scheduleKind_CRON',
    INTERVAL: 'triggers.scheduleKind_INTERVAL',
    HOURLY: 'triggers.scheduleKind_HOURLY',
    ONCE: 'triggers.scheduleKind_ONCE',
  };
  const k = map[kind];
  return k ? t(k) : kind;
}

function TypeHeaderIcon({ type }: { type: string }) {
  if (type === 'SCHEDULE') return <CalendarClock size={24} className="text-amber-400" />;
  if (type === 'TELEGRAM') return <MessageCircle size={24} className="text-sky-400" />;
  return <PlayCircle size={24} className="text-on-surface-variant" />;
}

export function TriggerDetailDrawer({ triggerId, onClose }: Props) {
  const { data: tr, isLoading } = useQuery({
    queryKey: ['workflow-trigger', triggerId],
    queryFn: () => triggersApi.getTrigger(triggerId!),
    enabled: !!triggerId,
  });

  const mc = parseMatchConfig(tr?.matchConfig);

  useEffect(() => {
    if (!triggerId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [triggerId]);

  return (
    <AnimatePresence>
      {triggerId ? (
        <div className="fixed inset-0 z-[90] flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full sm:max-w-lg h-full glass-card sm:border-l border-white/10 overflow-y-auto custom-scrollbar flex flex-col pb-[env(safe-area-inset-bottom,0px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-surface-container/95 backdrop-blur-md border-b border-white/10 px-4 py-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:pt-6">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 min-w-0">
                  {tr ? (
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-white/5 flex items-center justify-center shrink-0">
                      <TypeHeaderIcon type={tr.type} />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-1">
                      {t('triggers.detailTitle')}
                    </p>
                    <h3 className="text-lg sm:text-xl font-bold truncate">
                      {tr?.name?.trim() || tr?.workflow.name || '…'}
                    </h3>
                    {tr?.name ? (
                      <p className="text-sm text-on-surface-variant truncate">{tr.workflow.name}</p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
                  aria-label="Đóng"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="px-4 py-5 sm:p-6 flex-1 min-w-0">
              {isLoading ? (
                <p className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Loader2 size={16} className="animate-spin" /> {t('triggers.loading')}
                </p>
              ) : null}

              {tr ? (
                <div className="space-y-6 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{formatTriggerType(tr.type)}</Badge>
                    <Badge variant={tr.enabled ? 'success' : 'muted'}>
                      {tr.enabled ? t('triggers.enabled') : t('triggers.disabled')}
                    </Badge>
                  </div>

                  {tr.workflow.isActive === false ? (
                    <div className="rounded-xl border border-error/30 bg-error/10 p-4 text-xs text-error leading-relaxed">
                      {t('triggers.workflowInactiveHint')}
                      <Link
                        to="/workflows"
                        className="inline-flex items-center gap-1 mt-2 font-bold underline"
                      >
                        {t('triggers.openWorkflows')}
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  ) : null}

                  <Section title={t('triggers.sectionOverview')}>
                    <DetailRow label={t('triggers.colWorkflow')} value={tr.workflow.name} />
                    {tr.name ? (
                      <DetailRow label={t('triggers.fieldName')} value={tr.name} />
                    ) : null}
                  </Section>

                  {tr.type === 'SCHEDULE' ? (
                    <Section title={t('triggers.sectionSchedule')}>
                      <DetailRow
                        label={t('triggers.fieldScheduleKind')}
                        value={formatScheduleKind(tr.scheduleKind)}
                      />
                      {tr.cronExpression ? (
                        <DetailRow label={t('workflows.cronExpression')} value={tr.cronExpression} mono />
                      ) : null}
                      {tr.intervalSeconds ? (
                        <DetailRow
                          label={t('triggers.fieldIntervalMinutes')}
                          value={String(Math.round(tr.intervalSeconds / 60))}
                        />
                      ) : null}
                      {tr.scheduleKind === 'DAILY' ? (
                        <DetailRow
                          label={t('triggers.fieldHour')}
                          value={`${tr.dailyHour ?? 8}:${String(tr.dailyMinute ?? 0).padStart(2, '0')}`}
                        />
                      ) : null}
                      <DetailRow label={t('triggers.fieldTimezone')} value={tr.timezone} />
                      <DetailRow label={t('triggers.colNext')} value={formatDt(tr.nextRunAt)} mono />
                    </Section>
                  ) : null}

                  {tr.type === 'TELEGRAM' ? (
                    <Section title={t('triggers.sectionTelegram')}>
                      <DetailRow
                        label={t('triggers.selectBot')}
                        value={
                          tr.telegramBot?.name ??
                          (tr.telegramBot?.botUsername ? `@${tr.telegramBot.botUsername}` : null) ??
                          tr.telegramBotId ??
                          t('common.emDash')
                        }
                      />
                      {mc.commands?.length ? (
                        <DetailRow label={t('triggers.fieldCommands')} value={mc.commands.join(', ')} mono />
                      ) : null}
                      {mc.events?.length ? (
                        <DetailRow label={t('triggers.fieldEvents')} value={mc.events.join(', ')} />
                      ) : null}
                    </Section>
                  ) : null}

                  <Section title={t('triggers.sectionRuns')}>
                    <DetailRow label={t('triggers.colLast')} value={formatDt(tr.lastRunAt)} mono />
                    {tr.lastRunStatus ? (
                      <DetailRow
                        label={t('triggers.lastStatus')}
                        value={formatRunStatus(tr.lastRunStatus)}
                      />
                    ) : null}
                  </Section>

                  <div>
                    <h4 className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
                      {t('triggers.executionHistory')}
                    </h4>
                    {(tr.executions?.length ?? 0) === 0 ? (
                      <p className="text-xs text-on-surface-variant rounded-xl border border-dashed border-white/10 p-4 text-center">
                        {t('triggers.noExecutions')}
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {(tr.executions ?? []).map((ex) => (
                          <li
                            key={ex.id}
                            className="rounded-xl border border-white/10 p-3 text-xs bg-black/20"
                          >
                            <div className="flex justify-between gap-2 items-center">
                              <span
                                className={cn(
                                  'font-bold uppercase text-[10px] tracking-wide',
                                  ex.status === 'FAILED'
                                    ? 'text-error'
                                    : ex.status === 'COMPLETED'
                                      ? 'text-tertiary'
                                      : 'text-primary',
                                )}
                              >
                                {formatRunStatus(ex.status)}
                              </span>
                              <span className="text-on-surface-variant font-mono">
                                {formatDt(ex.startedAt)}
                              </span>
                            </div>
                            {ex.workflowRunId ? (
                              <p className="mt-1.5 text-on-surface-variant truncate font-mono text-[10px]">
                                run: {ex.workflowRunId}
                              </p>
                            ) : null}
                            {ex.error ? (
                              <p className="mt-1.5 text-error text-[11px] leading-snug">{ex.error}</p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
        {title}
      </h4>
      <div className="space-y-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
        {children}
      </div>
    </div>
  );
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'muted';
}) {
  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border',
        variant === 'success' && 'bg-tertiary/10 text-tertiary border-tertiary/20',
        variant === 'muted' && 'bg-white/5 text-on-surface-variant border-white/10',
        variant === 'default' && 'bg-primary/10 text-primary border-primary/20',
      )}
    >
      {children}
    </span>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4 sm:items-start min-w-0">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span
        className={cn(
          'break-all min-w-0 sm:text-right',
          mono ? 'font-mono text-primary/90 text-xs' : 'text-on-surface font-medium',
        )}
      >
        {value}
      </span>
    </div>
  );
}
