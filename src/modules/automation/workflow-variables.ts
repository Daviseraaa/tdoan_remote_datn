import { asciiSlugKey } from '../../common/slug-key';

export type StepOutput = {
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  result?: string;
  json?: unknown;
  /** Body JSON từ HTTP_REQUEST (payload.data) — dùng {{steps.<key>.data.*}} */
  data?: unknown;
  statusCode?: number;
  ok?: boolean;
  headers?: unknown;
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

/** `excel_data.0.name` hoặc `excel_data[0].name` — hỗ trợ index mảng trong template. */
export function tokenizePath(path: string): string[] {
  const parts: string[] = [];
  let buf = '';
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === '.') {
      if (buf) {
        parts.push(buf);
        buf = '';
      }
      continue;
    }
    if (c === '[') {
      if (buf) {
        parts.push(buf);
        buf = '';
      }
      i++;
      const start = i;
      while (i < path.length && path[i] !== ']') i++;
      parts.push(path.slice(start, i));
      continue;
    }
    buf += c;
  }
  if (buf) parts.push(buf);
  return parts.filter(Boolean);
}

function getByPath(root: unknown, path: string): unknown {
  const parts = tokenizePath(path);
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

function readStepField(out: StepOutput, field: string): unknown {
  if (!field || field === 'stdout') {
    if (out.stdout != null && String(out.stdout).length > 0) {
      return out.stdout;
    }
    if (out.result != null && String(out.result).length > 0) {
      return out.result;
    }
    return out.stderr ?? '';
  }
  const direct = getByPath(out, field);
  if (direct !== undefined) return direct;
  if (out.json !== undefined && field !== 'json') {
    const nested = getByPath(out.json, field);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

function resolveStepScopePath(
  steps: Record<string, StepOutput>,
  subPath: string,
): unknown {
  const dot = subPath.indexOf('.');
  const key = dot === -1 ? subPath.trim() : subPath.slice(0, dot).trim();
  const field = dot === -1 ? 'stdout' : subPath.slice(dot + 1);
  if (!key) return undefined;
  const out = steps[key];
  if (!out) return undefined;
  return readStepField(out, field);
}

/** Bước hoàn thành gần nhất (theo order) — dùng cho {{prev.*}} khi có nhiều step trong scope. */
function pickPrevStep(
  steps: Record<string, StepOutput>,
): StepOutput | undefined {
  const list = Object.values(steps);
  if (!list.length) return undefined;
  return list.reduce((best, cur) => (cur.order >= best.order ? cur : best));
}

function resolvePath(path: string, scope: WorkflowRunScope): unknown {
  if (path.startsWith('workflow.')) {
    return getByPath(scope.workflow, path.slice('workflow.'.length));
  }
  if (path.startsWith('steps.')) {
    return resolveStepScopePath(scope.steps, path.slice('steps.'.length));
  }
  if (path.startsWith('prev.')) {
    const prev = scope.prev ?? pickPrevStep(scope.steps);
    if (!prev) return undefined;
    return readStepField(prev, path.slice('prev.'.length));
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
): Pick<
  StepOutput,
  'stdout' | 'stderr' | 'result' | 'json' | 'data' | 'statusCode' | 'ok' | 'headers'
> {
  const raw = result ?? '';
  let stdout: string | undefined;
  let stderr: string | undefined;
  let json: unknown;
  let data: unknown;
  let statusCode: number | undefined;
  let ok: boolean | undefined;
  let headers: unknown;

  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.stdout === 'string') stdout = parsed.stdout;
      if (typeof parsed.stderr === 'string') stderr = parsed.stderr;
      if (stdout == null && typeof parsed.path === 'string') {
        stdout = parsed.path;
      }
      if (
        stdout == null &&
        parsed.telegramMessageId != null &&
        typeof parsed.telegramMessageId !== 'object'
      ) {
        stdout = `telegram:${parsed.telegramMessageId}`;
      }
      if (typeof parsed.statusCode === 'number') statusCode = parsed.statusCode;
      if (typeof parsed.ok === 'boolean') ok = parsed.ok;
      if (parsed.headers !== undefined) headers = parsed.headers;
      if (parsed.data !== undefined) {
        data = parsed.data;
        json = parsed.data;
      } else {
        json = parsed;
      }
    } catch {
      stdout = raw;
    }
  }

  return {
    stdout,
    stderr,
    result: raw || undefined,
    json,
    data,
    statusCode,
    ok,
    headers,
  };
}

export function defaultOutputKey(
  order: number,
  title?: string,
  stepId?: string,
  stepKey?: string,
): string {
  const fromTitle = slugify(title ?? '');
  if (fromTitle) return fromTitle;
  const sk = stepKey?.trim();
  if (sk) {
    const fromKey = slugify(sk);
    if (fromKey) return fromKey;
    if (!sk.startsWith('step-')) return sk.replace(/\s+/g, '_').slice(0, 48);
  }
  if (stepId && !stepId.startsWith('step-')) {
    return slugify(stepId) || `step_${order}`;
  }
  return `step_${order}`;
}

function slugify(s: string): string {
  return asciiSlugKey(s);
}

export function resolveOutputKey(
  config: { outputKey?: string; title?: string; stepKey?: string },
  order: number,
  stepId: string,
): string {
  const custom = config.outputKey?.trim();
  if (custom) return slugify(custom) || custom.replace(/\s+/g, '_');
  return defaultOutputKey(order, config.title, stepId, config.stepKey);
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
  return {
    workflow,
    steps,
    prev: pickPrevStep(steps),
  };
}

export function scopeFromContext(
  workflowVars: Record<string, unknown>,
  steps: Record<string, StepOutput>,
): WorkflowRunScope {
  return {
    workflow: workflowVars,
    steps,
    prev: pickPrevStep(steps),
  };
}

export function publishStepOutput(
  scope: WorkflowRunScope,
  key: string,
  output: StepOutput,
): WorkflowRunScope {
  const steps = { ...scope.steps, [key]: output };
  return {
    ...scope,
    steps,
    prev: pickPrevStep(steps),
  };
}

export function parseWorkflowVariables(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Gán tham số lệnh Telegram (args[0], …) vào biến workflow — giữ giá trị cấu hình nếu thiếu tham số.
 */
export function applyTelegramVariableBindings(
  vars: Record<string, unknown>,
  variableArgs: string[] | undefined,
  telegram: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!variableArgs?.length || !telegram) return vars;
  const args = telegram.args;
  if (!Array.isArray(args)) return vars;

  const out = { ...vars };
  for (let i = 0; i < variableArgs.length; i++) {
    const name = variableArgs[i]?.trim();
    if (!name || !VARIABLE_NAME_RE.test(name)) continue;
    const raw = args[i];
    if (raw === undefined || raw === null) continue;
    out[name] = coerceVariableValue(String(raw));
  }
  return out;
}

const VARIABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

export type WorkflowVariableMode = 'create' | 'read' | 'set';

export function normalizeVariableName(raw: string): string {
  const name = raw.trim();
  if (!VARIABLE_NAME_RE.test(name)) {
    throw new Error(`Invalid variable name: ${raw}`);
  }
  if (name.startsWith('_')) {
    throw new Error(`Reserved variable name: ${name}`);
  }
  return name;
}

export function hasWorkflowVar(scope: WorkflowRunScope, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(scope.workflow, name);
}

export function getWorkflowVar(scope: WorkflowRunScope, name: string): unknown {
  return scope.workflow[name];
}

export function setWorkflowVar(
  scope: WorkflowRunScope,
  name: string,
  value: unknown,
): WorkflowRunScope {
  return {
    ...scope,
    workflow: { ...scope.workflow, [name]: value },
  };
}

export function coerceVariableValue(raw: string): unknown {
  const t = raw.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    try {
      return JSON.parse(t);
    } catch {
      /* keep string */
    }
  }
  return raw;
}

export function resolveVariableValueTemplate(
  template: string | undefined,
  scope: WorkflowRunScope,
): unknown {
  if (template == null) return '';
  const resolved = resolveTemplateString(template, scope);
  return coerceVariableValue(resolved);
}

export function formatWorkflowValue(value: unknown): string {
  return formatValue(value);
}

/** Bỏ biến nội bộ (_openedPids, _loopIndex, …) trước khi lưu snapshot lần chạy. */
export function stripInternalWorkflowVars(
  workflow: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(workflow)) {
    if (!k.startsWith('_')) out[k] = v;
  }
  return out;
}

/** Trích `rows` từ chuỗi kết quả task FILE_OPERATION read_excel. */
export function extractExcelRowsFromTaskResult(
  result?: string,
  exitCode?: number | null,
): { rows: unknown[]; sheet?: string } {
  const parsed = parseTaskResult(result, exitCode ?? 0, false);
  const body = parsed.json;
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const rec = body as Record<string, unknown>;
    const rows = Array.isArray(rec.rows) ? rec.rows : [];
    return {
      rows,
      sheet: typeof rec.sheet === 'string' ? rec.sheet : undefined,
    };
  }
  if (Array.isArray(body)) return { rows: body };
  return { rows: [] };
}
