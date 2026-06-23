import { useMemo, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Circle,
  MinusCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import type {
  ExecuteWorkflowResult,
  Workflow,
  WorkflowRunStatus,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowStepRun,
  WorkflowStepRunOutput,
} from '@/src/types/api';
import {
  effectiveStepRunStatus,
  sortStepRuns,
  stepRunToStepResult,
} from '@/src/lib/workflowRunStatus';
import {
  computeExecutionWaves,
  stepRuntimeKey,
  type WfRunStatus,
} from '@/src/lib/workflowGraph';
import { formatStepRunOutput, hasStepRunOutput } from '@/src/lib/formatStepRunOutput';
import { t } from '@/src/i18n/t';

type Props = {
  open: boolean;
  onClose?: () => void;
  running: boolean;
  result: ExecuteWorkflowResult | null;
  workflow?: Workflow | null;
  runStatusByStepId: Record<string, WfRunStatus>;
  /** panel: thanh dưới editor; embedded: trong drawer lịch sử */
  variant?: 'panel' | 'embedded';
  /** Lịch sử: chỉ hiển thị bước đã ghi trong lần chạy, không theo workflow hiện tại */
  historicalStepRuns?: WorkflowStepRun[];
  /** Trạng thái tổng của lần chạy (để sửa step RUNNING stale trong lịch sử) */
  workflowRunStatus?: WorkflowRunStatus;
};

function stepTitle(
  step: WorkflowStep | undefined,
  order: number,
  removedFromWorkflow?: boolean,
): string {
  if (removedFromWorkflow) {
    return t('workflows.historyStepSnapshot', { order: String(order) });
  }
  const cfg = step?.config as { title?: string } | undefined;
  if (cfg?.title?.trim()) return cfg.title.trim();
  if (step?.type === 'DELAY') {
    return t('workflows.nodeDelay', {
      ms: (cfg as { delayMs?: number })?.delayMs ?? 1000,
    });
  }
  if (step?.type === 'EXCEL') {
    const excelCfg = cfg as { excelMode?: string; variableName?: string };
    return (excelCfg.excelMode ?? 'read') === 'read'
      ? t('workflows.nodeExcelRead')
      : t('workflows.nodeExcelWrite');
  }
  if (step?.type === 'VARIABLE') {
    const varCfg = cfg as { variableMode?: string };
    const mode = varCfg.variableMode ?? 'set';
    if (mode === 'create') return t('workflows.nodeVarCreate');
    if (mode === 'read') return t('workflows.nodeVarRead');
    return t('workflows.nodeVarSet');
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

function StepOutputBlock({
  output,
  running,
}: {
  output?: WorkflowStepRunOutput;
  running?: boolean;
}) {
  const text = formatStepRunOutput(output);
  if (!text) {
    return (
      <p className="text-xs text-on-surface-variant italic px-1">
        {running ? t('workflows.runStatusRunning') : t('workflows.executionNoOutput')}
      </p>
    );
  }
  return (
    <pre className="text-[11px] font-mono text-on-surface whitespace-pre-wrap break-all max-h-40 overflow-y-auto custom-scrollbar rounded-lg bg-black/30 border border-white/10 p-3">
      {text}
    </pre>
  );
}

function PlanRow({
  rowKey,
  title,
  status,
  wave,
  detail,
  selected,
  onSelect,
  isRunning,
}: {
  rowKey: string;
  title: string;
  status: WfRunStatus;
  wave?: number;
  detail?: WorkflowStepResult;
  selected: boolean;
  onSelect: (key: string) => void;
  isRunning?: boolean;
}) {
  const border =
    selected
      ? 'border-primary/50 ring-1 ring-primary/30 bg-primary/10'
      : status === 'completed'
        ? 'border-tertiary/25 bg-tertiary/5 hover:bg-tertiary/10'
        : status === 'failed'
          ? 'border-error/25 bg-error/5 hover:bg-error/10'
          : status === 'running'
            ? 'border-primary/25 bg-primary/5 hover:bg-primary/10'
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]';

  const expandable =
    status === 'completed' ||
    status === 'failed' ||
    status === 'running' ||
    hasStepRunOutput(detail?.output);

  return (
    <button
      type="button"
      onClick={() => expandable && onSelect(rowKey)}
      className={cn(
        'w-full text-left flex items-start gap-2.5 p-3 rounded-xl border text-sm transition-colors',
        border,
        expandable ? 'cursor-pointer' : 'cursor-default opacity-80',
      )}
    >
      <StatusIcon status={status} />
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate flex items-center gap-1">
          <span className="truncate">{title}</span>
          {expandable ? (
            <ChevronDown
              size={14}
              className={cn(
                'shrink-0 text-on-surface-variant transition-transform',
                selected && 'rotate-180 text-primary',
              )}
            />
          ) : null}
          <span className="text-on-surface-variant font-normal shrink-0">
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
        {selected ? (
          <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] font-mono font-bold uppercase text-primary">
              {t('workflows.executionStepOutput')}
            </p>
            <StepOutputBlock output={detail?.output} running={isRunning && status === 'running'} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function ResultRow({
  r,
  workflow,
  selected,
  onSelect,
}: {
  r: WorkflowStepResult;
  workflow: Workflow | null | undefined;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const status: WfRunStatus = r.status === 'completed' ? 'completed' : 'failed';
  const key = `${r.step}-${r.stepId ?? ''}-${r.path ?? ''}`;
  return (
    <PlanRow
      rowKey={key}
      title={stepTitle(workflow?.steps?.find((s) => s.order === r.step), r.step)}
      status={status}
      wave={r.wave}
      detail={r}
      selected={selected}
      onSelect={onSelect}
      isRunning={false}
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
  variant = 'panel',
  historicalStepRuns,
  workflowRunStatus,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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

  const historyRows = useMemo(() => {
    if (!historicalStepRuns?.length) return null;
    const stepById = new Map(
      (workflow?.steps ?? []).filter((s) => s.id).map((s) => [s.id!, s]),
    );
    return sortStepRuns(historicalStepRuns).map((sr) => {
      const step = stepById.get(sr.stepId);
      const removed = !step;
      return {
        key: sr.id,
        title: stepTitle(step, sr.order, removed),
        status: effectiveStepRunStatus(sr, workflowRunStatus),
        wave: sr.depth,
        detail: stepRunToStepResult(sr, workflow, workflowRunStatus),
      };
    });
  }, [historicalStepRuns, workflow, workflowRunStatus]);

  const planRows = useMemo(() => {
    if (historyRows) return [];
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
  }, [historyRows, workflow, runStatusByStepId, running]);

  const showPlan = historyRows
    ? historyRows.length > 0
    : running || Object.keys(runStatusByStepId).length > 0;

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

  const toggleSelect = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  if (!open) return null;

  const embedded = variant === 'embedded';

  const stepList = (
    <div
      className={cn(
        'overflow-y-auto custom-scrollbar p-3 space-y-2',
        embedded ? 'flex-1 min-h-0' : undefined,
      )}
    >
      {running ? (
        <p className="text-sm text-primary flex items-center gap-2 px-1 pb-1">
          <Loader2 size={16} className="animate-spin" />
          {t('workflows.executionRunning')}
        </p>
      ) : null}
      {!running && !result && !showPlan ? (
        <p className="text-xs text-on-surface-variant px-1">{t('workflows.executionEmpty')}</p>
      ) : null}

      {historyRows
        ? historyRows.map((row) => (
            <div key={row.key}>
              <PlanRow
                rowKey={row.key}
                title={row.title}
                status={row.status}
                wave={row.wave}
                detail={row.detail}
                selected={selectedKey === row.key}
                onSelect={toggleSelect}
                isRunning={running}
              />
            </div>
          ))
        : null}

      {!historyRows && showPlan
        ? planRows.map((row) => (
            <div key={row.key}>
              <PlanRow
                rowKey={row.key}
                title={stepTitle(row.step, row.step?.order ?? 0)}
                status={row.status}
                wave={row.wave}
                detail={resultByStepKey.get(row.key)}
                selected={selectedKey === row.key}
                onSelect={toggleSelect}
                isRunning={running}
              />
            </div>
          ))
        : null}

      {!historyRows && !showPlan && result && !running
        ? hasParallel
          ? paths.map((path) => (
              <div key={path} className="space-y-2">
                <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant px-1">
                  {t('workflows.executionBranch', { path })}
                </p>
                {sorted
                  .filter((r) => r.path === path)
                  .map((r) => {
                    const key = `${r.step}-${r.stepId ?? ''}-${r.path ?? ''}`;
                    return (
                      <div key={`${r.step}-${r.stepId ?? ''}-${r.taskId ?? ''}-${r.wave ?? ''}`}>
                        <ResultRow
                          r={r}
                          workflow={workflow}
                          selected={selectedKey === key}
                          onSelect={toggleSelect}
                        />
                      </div>
                    );
                  })}
              </div>
            ))
          : sorted.map((r) => {
              const key = `${r.step}-${r.stepId ?? ''}-${r.path ?? ''}`;
              return (
                <div key={`${r.step}-${r.stepId ?? ''}-${r.taskId ?? ''}-${r.wave ?? ''}`}>
                  <ResultRow
                    r={r}
                    workflow={workflow}
                    selected={selectedKey === key}
                    onSelect={toggleSelect}
                  />
                </div>
              );
            })
        : null}
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant px-1 mb-2">
          {t('workflows.executionClickStep')}
        </p>
        {stepList}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'border-t border-white/10 bg-surface-container-low/95 max-h-[45vh] sm:max-h-[320px] flex flex-col backdrop-blur-md min-w-0',
        'absolute bottom-0 left-0 right-0 z-20 shadow-[0_-12px_40px_rgba(0,0,0,0.45)]',
      )}
    >
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
        {onClose ? (
          <button type="button" onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg shrink-0">
            <X size={16} />
          </button>
        ) : null}
      </div>
      {stepList}
    </div>
  );
}
