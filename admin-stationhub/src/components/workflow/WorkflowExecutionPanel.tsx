import { useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Circle,
  MinusCircle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type {
  ExecuteWorkflowResult,
  Workflow,
  WorkflowStep,
  WorkflowStepResult,
} from '@/src/types/api';
import {
  computeExecutionWaves,
  stepRuntimeKey,
  type WfRunStatus,
} from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';

type Props = {
  open: boolean;
  onClose: () => void;
  running: boolean;
  result: ExecuteWorkflowResult | null;
  workflow?: Workflow | null;
  runStatusByStepId: Record<string, WfRunStatus>;
};

function stepTitle(step: WorkflowStep | undefined, order: number): string {
  const cfg = step?.config as { title?: string } | undefined;
  if (cfg?.title?.trim()) return cfg.title.trim();
  if (step?.type === 'DELAY') {
    return t('workflows.nodeDelay', {
      ms: (cfg as { delayMs?: number })?.delayMs ?? 1000,
    });
  }
  return `${t('workflows.stepId', { id: String(order) })}`;
}

function sortResults(results: WorkflowStepResult[]): WorkflowStepResult[] {
  return [...results].sort((a, b) => {
    const pathA = a.path ?? '';
    const pathB = b.path ?? '';
    if (pathA !== pathB) return pathA.localeCompare(pathB);
    const waveA = a.wave ?? 0;
    const waveB = b.wave ?? 0;
    if (waveA !== waveB) return waveA - waveB;
    return a.step - b.step;
  });
}

function statusLabel(status: WfRunStatus): string {
  switch (status) {
    case 'pending':
      return t('workflows.runStatusPending');
    case 'running':
      return t('workflows.runStatusRunning');
    case 'completed':
      return t('workflows.runStatusCompleted');
    case 'failed':
      return t('workflows.runStatusFailed');
    case 'skipped':
      return t('workflows.runStatusSkipped');
    default:
      return '';
  }
}

function StatusIcon({ status }: { status: WfRunStatus }) {
  if (status === 'running') {
    return <Loader2 size={16} className="animate-spin text-primary shrink-0 mt-0.5" />;
  }
  if (status === 'completed') {
    return <CheckCircle2 size={16} className="text-tertiary shrink-0 mt-0.5" />;
  }
  if (status === 'failed') {
    return <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />;
  }
  if (status === 'skipped') {
    return <MinusCircle size={16} className="text-on-surface-variant/50 shrink-0 mt-0.5" />;
  }
  return <Circle size={16} className="text-on-surface-variant/60 shrink-0 mt-0.5" />;
}

function PlanRow({
  title,
  status,
  wave,
  detail,
}: {
  title: string;
  status: WfRunStatus;
  wave?: number;
  detail?: WorkflowStepResult;
}) {
  const border =
    status === 'completed'
      ? 'border-tertiary/25 bg-tertiary/5'
      : status === 'failed'
        ? 'border-error/25 bg-error/5'
        : status === 'running'
          ? 'border-primary/25 bg-primary/5'
          : 'border-white/10 bg-white/[0.02]';

  return (
    <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-sm', border)}>
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate">
          {title}
          <span className="text-on-surface-variant font-normal">
            {' · '}
            {statusLabel(status)}
          </span>
        </p>
        {wave != null ? (
          <p className="text-[10px] font-mono text-on-surface-variant/80 mt-0.5">
            {t('workflows.executionWave', { wave: String(wave) })}
          </p>
        ) : null}
        {detail?.taskId ? (
          <p className="text-[10px] font-mono text-on-surface-variant/80 truncate mt-0.5">
            task {detail.taskId.slice(0, 12)}…
            {detail.exitCode != null ? ` · exit ${detail.exitCode}` : ''}
          </p>
        ) : null}
        {detail?.error ? (
          <p className="text-xs text-error mt-1 break-words">{detail.error}</p>
        ) : null}
      </div>
    </div>
  );
}

function ResultRow({
  r,
  workflow,
}: {
  r: WorkflowStepResult;
  workflow: Workflow | null | undefined;
}) {
  const status: WfRunStatus = r.status === 'completed' ? 'completed' : 'failed';
  return (
    <PlanRow
      title={stepTitle(workflow?.steps?.find((s) => s.order === r.step), r.step)}
      status={status}
      wave={r.wave}
      detail={r}
    />
  );
}

export function WorkflowExecutionPanel({
  open,
  onClose,
  running,
  result,
  workflow,
  runStatusByStepId,
}: Props) {
  const sorted = useMemo(
    () => (result?.results ? sortResults(result.results) : []),
    [result?.results],
  );

  const resultByStepKey = useMemo(() => {
    const map = new Map<string, WorkflowStepResult>();
    if (!workflow?.steps) return map;
    const keyByStepId = new Map(
      workflow.steps
        .filter((s) => s.id)
        .map((s) => [s.id!, stepRuntimeKey(s)]),
    );
    const orderToKey = new Map(
      workflow.steps.map((s) => [s.order, stepRuntimeKey(s)]),
    );
    for (const r of sorted) {
      let key: string | undefined;
      if (r.stepId) key = keyByStepId.get(r.stepId);
      if (!key) key = orderToKey.get(r.step);
      if (key) map.set(key, r);
    }
    return map;
  }, [sorted, workflow?.steps]);

  const planRows = useMemo(() => {
    if (!workflow) return [];
    const waves = computeExecutionWaves(workflow);
    const stepByKey = new Map(
      (workflow.steps ?? []).map((s) => [stepRuntimeKey(s), s]),
    );
    const rows: {
      key: string;
      step?: WorkflowStep;
      status: WfRunStatus;
      wave: number;
    }[] = [];
    waves.forEach((keys, wave) => {
      for (const key of keys) {
        rows.push({
          key,
          step: stepByKey.get(key),
          status: runStatusByStepId[key] ?? (running ? 'pending' : 'idle'),
          wave,
        });
      }
    });
    return rows;
  }, [workflow, runStatusByStepId, running]);

  const showPlan =
    running || Object.keys(runStatusByStepId).length > 0;

  const paths = useMemo(() => {
    const set = new Set(sorted.map((r) => r.path).filter(Boolean) as string[]);
    return [...set];
  }, [sorted]);

  const hasParallel = paths.length > 1;

  const statusCounts = useMemo(() => {
    const vals = Object.values(runStatusByStepId);
    return {
      pending: vals.filter((s) => s === 'pending').length,
      running: vals.filter((s) => s === 'running').length,
      completed: vals.filter((s) => s === 'completed').length,
      failed: vals.filter((s) => s === 'failed').length,
      skipped: vals.filter((s) => s === 'skipped').length,
    };
  }, [runStatusByStepId]);

  if (!open) return null;

  return (
    <div className="border-t border-white/5 bg-surface-container-low/60 shrink-0 max-h-[40vh] sm:max-h-[280px] flex flex-col backdrop-blur-sm min-w-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <h4 className="text-sm font-bold shrink-0">{t('workflows.executionTitle')}</h4>
          {hasParallel && !running ? (
            <span className="text-[10px] font-mono text-primary truncate">
              {t('workflows.executionParallel')}
            </span>
          ) : null}
          {showPlan && (running || result) ? (
            <span className="text-[10px] font-mono text-on-surface-variant shrink-0 truncate">
              {statusCounts.completed > 0 ? `${statusCounts.completed} OK` : null}
              {statusCounts.failed > 0
                ? `${statusCounts.completed > 0 ? ' · ' : ''}${statusCounts.failed} lỗi`
                : null}
              {statusCounts.skipped > 0
                ? ` · ${statusCounts.skipped} ${t('workflows.runStatusSkipped').toLowerCase()}`
                : null}
              {running && statusCounts.running > 0
                ? ` · ${statusCounts.running} ${t('workflows.runStatusRunning').toLowerCase()}`
                : null}
              {running && statusCounts.pending > 0
                ? ` · ${statusCounts.pending} ${t('workflows.runStatusPending').toLowerCase()}`
                : null}
            </span>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg shrink-0">
          <X size={16} />
        </button>
      </div>
      <div className="overflow-y-auto custom-scrollbar p-3 space-y-3">
        {running ? (
          <p className="text-sm text-primary flex items-center gap-2 px-1">
            <Loader2 size={16} className="animate-spin" />
            {t('workflows.executionRunning')}
          </p>
        ) : null}
        {!running && !result && !showPlan ? (
          <p className="text-xs text-on-surface-variant px-1">{t('workflows.executionEmpty')}</p>
        ) : null}

        {showPlan
          ? planRows.map((row) => (
              <div key={row.key}>
                <PlanRow
                  title={stepTitle(row.step, row.step?.order ?? 0)}
                  status={row.status}
                  wave={row.wave}
                  detail={resultByStepKey.get(row.key)}
                />
              </div>
            ))
          : null}

        {!showPlan && result && !running
          ? hasParallel
            ? paths.map((path) => (
                <div key={path} className="space-y-2">
                  <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant px-1">
                    {t('workflows.executionBranch', { path })}
                  </p>
                  {sorted
                    .filter((r) => r.path === path)
                    .map((r) => (
                      <div
                        key={`${r.step}-${r.stepId ?? ''}-${r.taskId ?? ''}-${r.wave ?? ''}`}
                      >
                        <ResultRow r={r} workflow={workflow} />
                      </div>
                    ))}
                </div>
              ))
            : sorted.map((r) => (
                <div
                  key={`${r.step}-${r.stepId ?? ''}-${r.taskId ?? ''}-${r.wave ?? ''}`}
                >
                  <ResultRow r={r} workflow={workflow} />
                </div>
              ))
          : null}
      </div>
    </div>
  );
}
