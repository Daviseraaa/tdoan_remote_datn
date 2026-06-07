import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkflowDetail, useWorkflowMutations } from '@/src/hooks/useWorkflows';
import { useAgentsList } from '@/src/hooks/useAgents';
import { apiErrorMessage } from '@/src/lib/api';
import { filterAgentsByCluster } from '@/src/lib/agentFilters';
import { t } from '@/src/i18n/t';
import type { ExecuteWorkflowResult, Workflow, WorkflowStep } from '@/src/types/api';
import type { WorkflowGraphV2, WfRunStatus } from '@/src/lib/workflowGraph';
import {
  buildRunStatusFromStepRuns,
  stepRunsToExecuteResult,
} from '@/src/lib/workflowRunStatus';
import * as workflowsApi from '@/src/api/workflows';
import {
  type EntryTriggerDraft,
  persistEntryTrigger,
} from '@/src/lib/workflowEntryTrigger';

export type WorkflowSavePayload = {
  steps: WorkflowStep[];
  graph: WorkflowGraphV2;
  entryTrigger?: EntryTriggerDraft;
  newTelegramBot?: { name: string; botToken: string };
};

const RUN_POLL_MS = 600;

function pickDefaultAgentId(wf: Workflow | null | undefined, agents: { id: string }[]): string {
  if (!wf?.steps?.length) return agents[0]?.id ?? '';
  for (const step of wf.steps) {
    const cfg = step.config as { agentId?: string };
    if (cfg?.agentId) return cfg.agentId;
  }
  return agents[0]?.id ?? '';
}

const TERMINAL_RUN = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

export function useWorkflowEditor(workflowId: string) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Workflow | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [defaultAgentId, setDefaultAgentId] = useState('');
  const [error, setError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecuteWorkflowResult | null>(null);
  const [runStatusByStepId, setRunStatusByStepId] = useState<Record<string, WfRunStatus>>({});
  const [showDelete, setShowDelete] = useState(false);
  const [graphReloadToken, setGraphReloadToken] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { update, remove } = useWorkflowMutations();
  const { data: agentsPage } = useAgentsList({ page: 1, limit: 100 });
  const { data: detail, isFetching: detailLoading, isError: detailError } = useWorkflowDetail(
    workflowId || null,
  );

  const agents = useMemo(
    () => filterAgentsByCluster(agentsPage?.items ?? [], 'all'),
    [agentsPage?.items],
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    setDraft(null);
    setIsDirty(false);
    setExecutionResult(null);
    setRunStatusByStepId({});
    setActiveRunId(null);
    setError('');
    setGraphReloadToken((n) => n + 1);
  }, [workflowId]);

  useEffect(() => {
    if (!detail || detail.id !== workflowId) return;
    if (!isDirty) {
      setDraft(detail);
      setGraphReloadToken((n) => n + 1);
    }
  }, [detail, workflowId, isDirty]);

  useEffect(() => {
    if (!defaultAgentId && agents.length) {
      setDefaultAgentId(agents[0].id);
    }
  }, [agents, defaultAgentId]);

  useEffect(() => {
    if (detail && !isDirty) {
      const picked = pickDefaultAgentId(detail, agents);
      if (picked) setDefaultAgentId(picked);
    }
  }, [detail?.id, agents, isDirty]);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const patchMeta = useCallback(
    (
      patch: Partial<
        Pick<
          Workflow,
          'name' | 'description' | 'cronExpression' | 'isActive' | 'variables' | 'stepDelayMs'
        >
      >,
    ) => {
      setDraft((d) => (d ? { ...d, ...patch } : d));
      setIsDirty(true);
    },
    [],
  );

  const save = useCallback(
    async (payload: WorkflowSavePayload) => {
      if (!draft?.id) return null;
      setError('');
      try {
        const saved = await update.mutateAsync({
          id: draft.id,
          dto: {
            name: draft.name,
            description: draft.description,
            cronExpression: draft.cronExpression,
            isActive: draft.isActive,
            stepDelayMs: draft.stepDelayMs ?? 0,
            variables: draft.variables,
            graph: payload.graph,
            steps: payload.steps,
          },
        });
        if (payload.entryTrigger) {
          await persistEntryTrigger(draft.id, payload.entryTrigger, {
            createBot: payload.newTelegramBot,
          });
          await queryClient.invalidateQueries({ queryKey: ['workflow-triggers'] });
        }
        setDraft(saved);
        setIsDirty(false);
        setGraphReloadToken((n) => n + 1);
        setSaveOk(true);
        window.setTimeout(() => setSaveOk(false), 2000);
        return saved;
      } catch (err) {
        setError(apiErrorMessage(err));
        return null;
      }
    },
    [draft, update, queryClient],
  );

  const run = useCallback(
    async (payload: WorkflowSavePayload) => {
      if (!draft?.id) return;
      setError('');
      setExecutionResult(null);
      setRunStatusByStepId({});
      setActiveRunId(null);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      let wf = draft;
      if (isDirty) {
        const saved = await save(payload);
        if (!saved) return;
        wf = saved;
      }

      setRunning(true);

      try {
        const start = await workflowsApi.executeWorkflow(wf.id);
        setActiveRunId(start.runId);

        const poll = async () => {
          const run = await workflowsApi.getWorkflowRun(start.runId);
          setRunStatusByStepId(buildRunStatusFromStepRuns(wf, run.stepRuns));
          if (TERMINAL_RUN.has(run.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setRunning(false);
            setExecutionResult(stepRunsToExecuteResult(wf, start.runId, run.stepRuns));
          }
        };

        await poll();
        pollRef.current = setInterval(() => void poll(), RUN_POLL_MS);
      } catch (err) {
        setError(apiErrorMessage(err));
        setRunStatusByStepId({});
        setRunning(false);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
      }
    },
    [draft, isDirty, save],
  );

  const deleteActive = useCallback(async () => {
    if (!draft?.id) return false;
    setError('');
    try {
      await remove.mutateAsync(draft.id);
      setShowDelete(false);
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    }
  }, [draft, remove]);

  return {
    draft,
    detailLoading,
    detailError,
    isDirty,
    markDirty,
    patchMeta,
    save,
    run,
    deleteActive,
    showDelete,
    setShowDelete,
    agents,
    defaultAgentId,
    setDefaultAgentId,
    error,
    setError,
    saveOk,
    saving: update.isPending,
    running,
    activeRunId,
    executionResult,
    runStatusByStepId,
    graphReloadToken,
  };
}

export async function createDefaultWorkflow(
  create: ReturnType<typeof useWorkflowMutations>['create'],
  agents: { id: string }[],
): Promise<Workflow | null> {
  const agentId = agents[0]?.id;
  if (!agentId) {
    throw new Error(t('workflows.noAgents'));
  }
  return create.mutateAsync({
    name: t('workflows.untitled'),
    description: t('workflows.newDescription'),
    isActive: false,
    graph: {
      version: 2,
      edges: [
        { from: '__trigger__', to: 'step-delay-1' },
        { from: 'step-delay-1', to: 'step-cmd-2' },
      ],
    },
    steps: [
      {
        order: 1,
        type: 'DELAY',
        config: {
          delayMs: 1000,
          stepKey: 'step-delay-1',
          title: t('workflows.nodeDelay', { ms: 1000 }),
          ui: { x: 348, y: 220 },
        },
        onFailure: 'STOP',
      },
      {
        order: 2,
        type: 'COMMAND',
        config: {
          command: 'echo workflow',
          stepKey: 'step-cmd-2',
          agentId,
          taskType: 'COMMAND',
          title: t('taskType.COMMAND'),
          ui: { x: 648, y: 220 },
        },
        onFailure: 'STOP',
      },
    ],
  });
}
