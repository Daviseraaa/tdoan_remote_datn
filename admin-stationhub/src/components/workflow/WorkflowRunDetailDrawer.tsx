import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkflowExecutionPanel } from './WorkflowExecutionPanel';
import { WorkflowRunStatusBadge } from './WorkflowRunStatusBadge';
import { useWorkflowDetail } from '@/src/hooks/useWorkflows';
import { useWorkflowRunDetail } from '@/src/hooks/useWorkflowRuns';
import { formatTaskDateTime, formatTaskDurationMs } from '@/src/lib/taskDetailFormat';
import {
  buildRunStatusFromStepRuns,
  stepRunsToExecuteResult,
} from '@/src/lib/workflowRunStatus';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import type { WorkflowRunListItem } from '@/src/types/api';

function triggerLabel(type: string | null | undefined): string {
  switch (type) {
    case 'MANUAL':
      return t('workflows.triggerManual');
    case 'SCHEDULE':
      return t('workflows.triggerSchedule');
    case 'TELEGRAM':
      return t('workflows.triggerTelegram');
    default:
      return t('workflows.manualTrigger');
  }
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 border-b border-white/5 last:border-0">
      <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant sm:w-36 shrink-0">
        {label}
      </span>
      <div className="text-sm min-w-0 flex-1">{children}</div>
    </div>
  );
}

type Props = {
  runId: string | null;
  fallback?: WorkflowRunListItem | null;
  onClose: () => void;
};

export function WorkflowRunDetailDrawer({ runId, fallback, onClose }: Props) {
  const navigate = useNavigate();
  const { data: run, isLoading: runLoading } = useWorkflowRunDetail(runId);
  const workflowId = run?.workflowId ?? fallback?.workflowId ?? null;
  const { data: workflow, isLoading: wfLoading } = useWorkflowDetail(workflowId);

  const selected = run ?? null;
  const running = selected?.status === 'RUNNING' || selected?.status === 'PENDING';

  const runStatusByStepId = useMemo(
    () => buildRunStatusFromStepRuns(workflow, selected?.stepRuns ?? []),
    [workflow, selected?.stepRuns],
  );

  const executionResult = useMemo(() => {
    if (!workflow || !selected) return null;
    return stepRunsToExecuteResult(workflow, selected.id, selected.stepRuns);
  }, [workflow, selected]);

  const durationMs = useMemo(() => {
    if (!selected?.startedAt) return undefined;
    const end = selected.completedAt ? new Date(selected.completedAt) : new Date();
    const start = new Date(selected.startedAt);
    const ms = end.getTime() - start.getTime();
    return ms >= 0 ? ms : undefined;
  }, [selected?.startedAt, selected?.completedAt]);

  const runVariablesText = useMemo(() => {
    const vars = selected?.variables;
    if (!vars || typeof vars !== 'object' || Array.isArray(vars)) return '';
    const publicVars = Object.fromEntries(
      Object.entries(vars).filter(([k]) => !k.startsWith('_')),
    );
    if (!Object.keys(publicVars).length) return '';
    try {
      return JSON.stringify(publicVars, null, 2);
    } catch {
      return String(publicVars);
    }
  }, [selected?.variables]);

  const loading = runLoading && !selected;

  return createPortal(
    <AnimatePresence>
      {runId ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 h-full w-full max-w-[720px] bg-surface border-l border-white/10 z-[70] flex flex-col shadow-2xl"
          >
            <div className="p-4 sm:p-6 border-b border-white/5 shrink-0 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold truncate">
                    {t('workflows.historyDetailTitle', {
                      id: (selected?.id ?? runId).slice(0, 8),
                    })}
                  </h3>
                  <p className="text-sm text-on-surface-variant truncate mt-1">
                    {selected?.workflow.name ?? fallback?.workflow.name ?? '—'}
                  </p>
                  <div className="mt-2">
                    {selected ? (
                      <WorkflowRunStatusBadge status={selected.status} size="md" />
                    ) : fallback ? (
                      <WorkflowRunStatusBadge status={fallback.status} size="md" />
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-full shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {loading ? (
                <div className="flex justify-center py-12 text-on-surface-variant">
                  <Loader2 className="animate-spin w-8 h-8" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 min-h-0 space-y-6">
                  <div className="rounded-xl border border-white/10 overflow-hidden bg-surface-container-low/20 shrink-0">
                    <DetailRow label={t('workflows.historyDetailRunId')}>
                      <span className="font-mono text-xs break-all">{selected?.id ?? runId}</span>
                    </DetailRow>
                    <DetailRow label={t('workflows.historyDetailWorkflow')}>
                      <button
                        type="button"
                        onClick={() => {
                          if (workflowId) navigate(`/workflows/${workflowId}/edit`);
                        }}
                        className={cn(
                          'text-left text-primary hover:underline truncate',
                          !workflowId && 'pointer-events-none text-on-surface',
                        )}
                      >
                        {selected?.workflow.name ?? fallback?.workflow.name ?? '—'}
                      </button>
                    </DetailRow>
                    <DetailRow label={t('workflows.triggerType')}>
                      {triggerLabel(selected?.triggerType ?? fallback?.triggerType)}
                    </DetailRow>
                    <DetailRow label={t('workflows.historyDetailStarted')}>
                      {formatTaskDateTime(selected?.startedAt ?? fallback?.startedAt)}
                    </DetailRow>
                    <DetailRow label={t('workflows.historyDetailCompleted')}>
                      {formatTaskDateTime(selected?.completedAt ?? fallback?.completedAt)}
                    </DetailRow>
                    <DetailRow label={t('workflows.historyDetailDuration')}>
                      {formatTaskDurationMs(durationMs)}
                    </DetailRow>
                  </div>

                  {runVariablesText ? (
                    <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 overflow-hidden shrink-0">
                      <p className="text-[10px] font-mono font-bold uppercase text-emerald-400 px-4 pt-3">
                        {t('workflows.historyDetailVariables')}
                      </p>
                      <pre className="text-[11px] font-mono text-on-surface whitespace-pre-wrap break-all p-4 pt-2">
                        {runVariablesText}
                      </pre>
                    </div>
                  ) : null}

                  <WorkflowExecutionPanel
                    open
                    variant="embedded"
                    running={running}
                    result={executionResult}
                    workflow={workflow}
                    runStatusByStepId={runStatusByStepId}
                    historicalStepRuns={selected?.stepRuns}
                    workflowRunStatus={selected?.status}
                  />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
