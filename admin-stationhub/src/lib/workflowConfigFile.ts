import { randomIdShort } from '@/src/lib/randomId';
import { t } from '@/src/i18n/t';
import type { Workflow, WorkflowStep, WorkflowStepConfig } from '@/src/types/api';
import type { WorkflowGraphV2 } from '@/src/lib/workflowGraph';

export const WORKFLOW_CONFIG_FORMAT = 'stationhub-workflow' as const;
export const WORKFLOW_CONFIG_VERSION = 1;

export type WorkflowConfigBundle = {
  name: string;
  description?: string;
  variables?: Record<string, unknown>;
  stepDelayMs?: number;
  closeOpenedOnFinish?: boolean;
  cronExpression?: string;
  graph?: WorkflowGraphV2;
  steps: WorkflowStep[];
};

export type WorkflowConfigFile = {
  format: typeof WORKFLOW_CONFIG_FORMAT;
  formatVersion: typeof WORKFLOW_CONFIG_VERSION;
  exportedAt: string;
  workflow: WorkflowConfigBundle;
};

function parseStepConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

export function buildWorkflowConfigFile(
  meta: Pick<
    Workflow,
    'name' | 'description' | 'variables' | 'stepDelayMs' | 'closeOpenedOnFinish' | 'cronExpression'
  >,
  payload: { steps: WorkflowStep[]; graph: WorkflowGraphV2 },
): WorkflowConfigFile {
  return {
    format: WORKFLOW_CONFIG_FORMAT,
    formatVersion: WORKFLOW_CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    workflow: {
      name: meta.name?.trim() || t('workflows.untitled'),
      description: meta.description?.trim() || undefined,
      variables: meta.variables ?? {},
      stepDelayMs: meta.stepDelayMs ?? 0,
      closeOpenedOnFinish: meta.closeOpenedOnFinish ?? false,
      cronExpression: meta.cronExpression?.trim() || undefined,
      graph: payload.graph,
      steps: payload.steps,
    },
  };
}

export function slugifyWorkflowFilename(name: string): string {
  const slug = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || 'workflow';
}

export function downloadWorkflowConfigFile(file: WorkflowConfigFile): void {
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = `${slugifyWorkflowFilename(file.workflow.name)}.stationhub-workflow.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function collectStepKeys(steps: WorkflowStep[]): Set<string> {
  const keys = new Set<string>();
  for (const step of steps) {
    const cfg = parseStepConfig(step.config);
    const key = cfg.stepKey?.trim() || step.id?.trim();
    if (key) keys.add(key);
  }
  return keys;
}

function normalizeImportedGraph(
  graph: unknown,
  stepKeys: Set<string>,
): WorkflowGraphV2 | undefined {
  if (!graph || typeof graph !== 'object') return undefined;
  const g = graph as WorkflowGraphV2;
  if (g.version !== 2 || !Array.isArray(g.edges)) return undefined;

  const edges = g.edges.filter((e) => {
    if (!e?.to || !stepKeys.has(e.to)) return false;
    if (e.from === '__trigger__') return true;
    return Boolean(e.from && stepKeys.has(e.from));
  });

  return { version: 2, edges };
}

/** Gán agent mặc định; giữ stepKey để graph import khớp. */
export function normalizeImportedWorkflowSteps(
  steps: unknown,
  defaultAgentId: string,
  knownAgentIds?: ReadonlySet<string>,
): WorkflowStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error(t('workflows.configFile.stepsRequired'));
  }

  const out: WorkflowStep[] = [];
  steps.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const step = raw as WorkflowStep;
    if (typeof step.order !== 'number' && step.order == null) {
      /* order optional in file */
    }
    const cfg = parseStepConfig(step.config);
    const stepKey = cfg.stepKey?.trim() || step.id?.trim() || `step-${index + 1}-${randomIdShort()}`;
    const nextCfg: WorkflowStepConfig = {
      ...cfg,
      stepKey,
      ui: cfg.ui,
    };
    if (defaultAgentId) {
      const needsAgent =
        step.type === 'COMMAND' ||
        step.type === 'SCRIPT' ||
        step.type === 'EXCEL' ||
        step.type === 'TELEGRAM' ||
        nextCfg.agentId != null;
      if (needsAgent) {
        const keep =
          nextCfg.agentId &&
          knownAgentIds &&
          knownAgentIds.has(nextCfg.agentId);
        if (!keep) nextCfg.agentId = defaultAgentId;
      }
    }
    out.push({
      ...step,
      id: stepKey,
      order: index + 1,
      config: nextCfg,
      onFailure: step.onFailure ?? 'STOP',
    });
  });

  if (out.length === 0) {
    throw new Error(t('workflows.configFile.stepsRequired'));
  }
  return out;
}

export function parseWorkflowConfigFileText(text: string): WorkflowConfigFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(t('workflows.configFile.invalidJson'));
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(t('workflows.configFile.invalidShape'));
  }

  const root = parsed as Record<string, unknown>;
  let bundle: WorkflowConfigBundle;

  if (root.format === WORKFLOW_CONFIG_FORMAT) {
    if (root.formatVersion !== WORKFLOW_CONFIG_VERSION) {
      throw new Error(t('workflows.configFile.unsupportedVersion'));
    }
    const wf = root.workflow;
    if (!wf || typeof wf !== 'object') {
      throw new Error(t('workflows.configFile.invalidShape'));
    }
    const w = wf as WorkflowConfigBundle;
    if (!Array.isArray(w.steps)) {
      throw new Error(t('workflows.configFile.stepsRequired'));
    }
    bundle = {
      name: typeof w.name === 'string' ? w.name : t('workflows.untitled'),
      description: typeof w.description === 'string' ? w.description : undefined,
      variables:
        w.variables && typeof w.variables === 'object' && !Array.isArray(w.variables)
          ? (w.variables as Record<string, unknown>)
          : {},
      stepDelayMs: typeof w.stepDelayMs === 'number' ? w.stepDelayMs : 0,
      closeOpenedOnFinish: Boolean(w.closeOpenedOnFinish),
      cronExpression: typeof w.cronExpression === 'string' ? w.cronExpression : undefined,
      graph: w.graph,
      steps: w.steps,
    };
  } else if (Array.isArray(root.steps)) {
    bundle = {
      name: typeof root.name === 'string' ? root.name : t('workflows.untitled'),
      description: typeof root.description === 'string' ? root.description : undefined,
      variables:
        root.variables && typeof root.variables === 'object' && !Array.isArray(root.variables)
          ? (root.variables as Record<string, unknown>)
          : {},
      stepDelayMs: typeof root.stepDelayMs === 'number' ? root.stepDelayMs : 0,
      closeOpenedOnFinish: Boolean(root.closeOpenedOnFinish),
      cronExpression: typeof root.cronExpression === 'string' ? root.cronExpression : undefined,
      graph: root.graph as WorkflowGraphV2 | undefined,
      steps: root.steps as WorkflowStep[],
    };
  } else {
    throw new Error(t('workflows.configFile.invalidShape'));
  }

  return {
    format: WORKFLOW_CONFIG_FORMAT,
    formatVersion: WORKFLOW_CONFIG_VERSION,
    exportedAt:
      typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString(),
    workflow: bundle,
  };
}

export function prepareImportedWorkflowBundle(
  file: WorkflowConfigFile,
  defaultAgentId: string,
  knownAgentIds?: ReadonlySet<string>,
): WorkflowConfigBundle {
  const steps = normalizeImportedWorkflowSteps(
    file.workflow.steps,
    defaultAgentId,
    knownAgentIds,
  );
  const stepKeys = collectStepKeys(steps);
  const graph = normalizeImportedGraph(file.workflow.graph, stepKeys);

  return {
    ...file.workflow,
    steps,
    graph,
  };
}
