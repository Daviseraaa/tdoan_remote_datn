export type StepOutput = {
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  result?: string;
  json?: unknown;
  failed: boolean;
  stepId: string;
  order: number;
};

export type WorkflowRunScope = {
  workflow: Record<string, unknown>;
  steps: Record<string, StepOutput>;
  prev?: StepOutput;
  telegram?: Record<string, unknown>;
  schedule?: Record<string, unknown>;
};

const TEMPLATE_RE = /\{\{([^}]+)\}\}/g;

function getByPath(root: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function resolveTemplateString(
  input: string,
  scope: WorkflowRunScope,
): string {
  if (!input.includes('{{')) return input;
  return input.replace(TEMPLATE_RE, (_, rawPath: string) => {
    const path = rawPath.trim();
    if (!path) return '';
    const value = resolvePath(path, scope);
    return formatValue(value);
  });
}

function resolvePath(path: string, scope: WorkflowRunScope): unknown {
  if (path.startsWith('workflow.')) {
    return getByPath(scope.workflow, path.slice('workflow.'.length));
  }
  if (path.startsWith('steps.')) {
    return getByPath(scope.steps, path.slice('steps.'.length));
  }
  if (path.startsWith('prev.')) {
    if (!scope.prev) return undefined;
    return getByPath(scope.prev, path.slice('prev.'.length));
  }
  if (path.startsWith('telegram.')) {
    if (!scope.telegram) return undefined;
    return getByPath(scope.telegram, path.slice('telegram.'.length));
  }
  if (path === 'telegram') return scope.telegram;
  if (path.startsWith('schedule.')) {
    if (!scope.schedule) return undefined;
    return getByPath(scope.schedule, path.slice('schedule.'.length));
  }
  return undefined;
}

/** Scope từ WorkflowRun.variables (workflow + trigger payload). */
export function buildRunScope(raw: unknown): WorkflowRunScope {
  const vars =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const { telegram, schedule, ...workflowRest } = vars;
  return {
    workflow: workflowRest,
    steps: {},
    ...(telegram && typeof telegram === 'object' && !Array.isArray(telegram)
      ? { telegram: telegram as Record<string, unknown> }
      : {}),
    ...(schedule && typeof schedule === 'object' && !Array.isArray(schedule)
      ? { schedule: schedule as Record<string, unknown> }
      : {}),
  };
}

export function resolvePayload(
  payload: Record<string, unknown> | undefined,
  scope: WorkflowRunScope,
): Record<string, unknown> | undefined {
  if (!payload) return payload;
  return deepResolve(payload, scope) as Record<string, unknown>;
}

function deepResolve(value: unknown, scope: WorkflowRunScope): unknown {
  if (typeof value === 'string') {
    return resolveTemplateString(value, scope);
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepResolve(v, scope));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = deepResolve(v, scope);
    }
    return out;
  }
  return value;
}

export function parseTaskResult(
  result: string | undefined,
  exitCode: number | null,
  failed: boolean,
): Pick<StepOutput, 'stdout' | 'stderr' | 'result' | 'json'> {
  const raw = result ?? '';
  let stdout: string | undefined;
  let stderr: string | undefined;
  let json: unknown;

  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.stdout === 'string') stdout = parsed.stdout;
      if (typeof parsed.stderr === 'string') stderr = parsed.stderr;
      if (parsed.data !== undefined) json = parsed.data;
      else json = parsed;
    } catch {
      stdout = raw;
    }
  }

  return { stdout, stderr, result: raw || undefined, json };
}

export function defaultOutputKey(
  order: number,
  title?: string,
  stepId?: string,
): string {
  const fromTitle = slugify(title ?? '');
  if (fromTitle) return fromTitle;
  if (stepId && !stepId.startsWith('step-')) {
    return slugify(stepId) || `step_${order}`;
  }
  return `step_${order}`;
}

function slugify(s: string): string {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return t.length ? t.slice(0, 48) : '';
}

export function resolveOutputKey(
  config: { outputKey?: string; title?: string },
  order: number,
  stepId: string,
): string {
  const custom = config.outputKey?.trim();
  if (custom) return slugify(custom) || custom.replace(/\s+/g, '_');
  return defaultOutputKey(order, config.title, stepId);
}

export function buildStepOutput(
  step: { id: string; order: number },
  config: { outputKey?: string; title?: string },
  outcome: {
    exitCode: number | null;
    failed: boolean;
    result?: string;
  },
): { key: string; output: StepOutput } {
  const key = resolveOutputKey(config, step.order, step.id);
  const parsed = parseTaskResult(outcome.result, outcome.exitCode, outcome.failed);
  return {
    key,
    output: {
      exitCode: outcome.exitCode,
      failed: outcome.failed,
      stepId: step.id,
      order: step.order,
      ...parsed,
    },
  };
}

export function mergeScopes(scopes: WorkflowRunScope[]): WorkflowRunScope {
  const workflow: Record<string, unknown> = {};
  const steps: Record<string, StepOutput> = {};
  for (const s of scopes) {
    Object.assign(workflow, s.workflow);
    for (const [k, v] of Object.entries(s.steps)) {
      if (steps[k] && steps[k] !== v) {
        // later parent overwrites on join
      }
      steps[k] = v;
    }
  }
  const prevList = Object.values(steps);
  return {
    workflow,
    steps,
    prev: prevList.length === 1 ? prevList[0] : undefined,
  };
}

export function scopeFromContext(
  workflowVars: Record<string, unknown>,
  steps: Record<string, StepOutput>,
): WorkflowRunScope {
  const prevList = Object.values(steps);
  return {
    workflow: workflowVars,
    steps,
    prev: prevList.length === 1 ? prevList[0] : undefined,
  };
}

export function publishStepOutput(
  scope: WorkflowRunScope,
  key: string,
  output: StepOutput,
): WorkflowRunScope {
  const steps = { ...scope.steps, [key]: output };
  const prevList = Object.values(steps);
  return {
    ...scope,
    steps,
    prev: prevList.length === 1 ? prevList[0] : undefined,
  };
}

export function parseWorkflowVariables(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}
