export type Role = 'ADMIN' | 'USER';

export type TaskStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface TaskLog {
  id: string;
  level: LogLevel;
  message: string;
  createdAt: string;
  taskId?: string;
}

export type TaskType =
  | 'COMMAND'
  | 'SCRIPT'
  | 'FILE_OPERATION'
  | 'SYSTEM_INFO'
  | 'OPEN_APP'
  | 'OPEN_BROWSER'
  | 'CLOSE_APP'
  | 'CHROME_EXTENSION'
  | 'DESKTOP_AUTOMATION'
  | 'SCREEN_CAPTURE'
  | 'HTTP_REQUEST'
  | 'TELEGRAM_SEND';

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export interface AgentChromeProfile {
  directory: string;
  name?: string;
}

export type WorkflowVariableMode = 'create' | 'read' | 'set';

export type WorkflowExcelMode = 'read' | 'write';

export type WorkflowStepType =
  | 'COMMAND'
  | 'SCRIPT'
  | 'DELAY'
  | 'CONDITION'
  | 'LOOP'
  | 'VARIABLE'
  | 'EXCEL'
  | 'TELEGRAM';
export type TelegramStepAction =
  | 'send_message'
  | 'send_photo'
  | 'send_document'
  | 'reply_message'
  | 'edit_message'
  | 'inline_keyboard';
export type WorkflowStepOnFailure = 'STOP' | 'SKIP' | 'RETRY';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionPlan {
  id: string;
  name: string;
  /** Giá niêm yết — bằng priceVnd thì không hiển thị giảm giá */
  originalPriceVnd: number;
  /** Giá bán thực tế */
  priceVnd: number;
  durationDays: number;
  maxAgents: number;
  description?: string | null;
  isActive?: boolean;
  isTrial?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionExpiresAt?: string | null;
  daysLeft?: number;
  isSubscriptionActive?: boolean;
  plan?: SubscriptionPlan | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface SubscriptionSnapshot {
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  daysLeft: number;
  isActive: boolean;
  plan: SubscriptionPlan | null;
}

export interface PaymentRecord {
  id: string;
  amountVnd: number;
  status: string;
  orderCode: string;
  paymentCode?: string;
  paidAt?: string | null;
  createdAt: string;
  plan: { name: string; durationDays: number };
}

export interface CheckoutResponse {
  paymentId: string;
  orderCode: string;
  paymentCode: string;
  amountVnd: number;
  planName: string;
  expiresAt: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferContent: string;
  qrUrl: string;
  webhookHint?: string;
}

export interface PaymentStatusResponse {
  id: string;
  status: string;
  paymentCode: string;
  amountVnd: number;
  paidAt?: string | null;
  expiresAt?: string | null;
}

export interface ChromeScript {
  id: string;
  name: string;
  startUrl?: string | null;
  steps: unknown[];
  source: string;
  localId?: string | null;
  userId: string;
  agentId?: string | null;
  agent?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateChromeScriptDto {
  name?: string;
  startUrl?: string;
  steps?: unknown[];
}

export interface DesktopRecording {
  id: string;
  name: string;
  steps: unknown[];
  source: string;
  localId?: string | null;
  userId: string;
  agentId?: string | null;
  agent?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateDesktopRecordingDto {
  name?: string;
  steps?: unknown[];
}

export interface WakeAgentDto {
  macAddress?: string;
  broadcast?: string;
  port?: number;
}

export interface UpdateRemoteAccessDto {
  wolMacAddress?: string;
  wolBroadcast?: string;
  rdpHost?: string;
  rdpPort?: number;
  rdpEnabled?: boolean;
}

export interface StartAgentRemoteResponse {
  ok: boolean;
  active: boolean;
  agentId: string;
  agentName: string;
  provider: string;
  rustdeskId?: string;
  rustdeskPassword?: string;
  rustdeskPath?: string;
  message: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface AgentFileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modifiedAt?: number;
}

export interface AgentFileListResponse {
  agentId: string;
  agentName: string;
  path: string;
  root: string;
  entries: AgentFileEntry[];
}

export interface AgentFileWriteResponse {
  agentId: string;
  agentName: string;
  path: string;
  size: number;
  written: boolean;
}

export interface Agent {
  id: string;
  name: string;
  os?: string;
  hostname?: string;
  ip?: string;
  status: AgentStatus;
  userId?: string;
  lastSeenAt?: string;
  lastHeartbeatAt?: string;
  metadata?: Record<string, unknown> | null;
  chromeProfiles?: AgentChromeProfile[] | null;
  createdAt?: string;
  updatedAt?: string;
  agentKey?: string;
  user?: { id: string; email: string; name: string };
}

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  command?: string;
  payload?: Record<string, unknown> | null;
  agentId: string;
  agent?: Agent;
  userId?: string;
  result?: string | null;
  error?: string;
  exitCode?: number | null;
  priority?: number;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  scheduledAt?: string | null;
  startedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  logs?: TaskLog[];
}

export interface TaskTemplate {
  id: string;
  name: string;
  type: TaskType;
  command: string;
  agentId: string;
  userId: string;
  timeout: number;
  priority: number;
  payload?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
  agent?: Pick<Agent, 'id' | 'name' | 'status'>;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export type WorkflowConditionMode =
  | 'last_exit_success'
  | 'last_exit_failed'
  | 'last_exit_code_eq';

export type WorkflowGraphEdge = {
  source: string;
  target: string;
  sourceHandle?: string;
};

/** Lưu DB — theo order (0=trigger) để không vỡ khi step id đổi sau save */
export type WorkflowGraphEdgeStored = {
  sourceOrder: number;
  targetOrder: number;
  sourceHandle?: string;
  source?: string;
  target?: string;
};

export interface WorkflowStepConfig {
  agentId?: string;
  taskType?: TaskType;
  command?: string;
  payload?: Record<string, unknown>;
  timeout?: number;
  delayMs?: number;
  /** Chờ sau bước (ms); ghi đè stepDelayMs workflow */
  delayAfterMs?: number;
  title?: string;
  outputKey?: string;
  /** Định danh ổn định node (= node.id canvas) */
  stepKey?: string;
  /** @deprecated dùng stepKey */
  stepOrder?: number;
  ui?: { x: number; y: number };
  graphEdges?: WorkflowGraphEdgeStored[] | WorkflowGraphEdge[];
  conditionMode?: WorkflowConditionMode;
  conditionExitCode?: number;
  /** Số lần lặp thân vòng (node LOOP) */
  loopCount?: number;
  variableMode?: WorkflowVariableMode;
  variableName?: string;
  variableValue?: string;
  excelMode?: WorkflowExcelMode;
  filePath?: string;
  sheetName?: string;
  hasHeader?: boolean;
  action?: TelegramStepAction;
  telegramBotId?: string;
  botToken?: string;
  chatId?: string;
  text?: string;
  photoUrl?: string;
  documentUrl?: string;
  replyToMessageId?: number | string;
  messageId?: number | string;
  /** Node trigger canvas — MANUAL | SCHEDULE | TELEGRAM (UI only) */
  triggerType?: 'MANUAL' | 'SCHEDULE' | 'TELEGRAM';
}

export interface WorkflowStep {
  id?: string;
  order: number;
  type: WorkflowStepType;
  config: WorkflowStepConfig | Record<string, unknown>;
  onFailure?: WorkflowStepOnFailure;
}

export interface WorkflowStepRunOutput {
  stdout?: string;
  stderr?: string;
  json?: unknown;
  branch?: string;
  actionResult?: string;
  exitCode?: number | null;
}

export interface WorkflowStepResult {
  step: number;
  stepId?: string;
  status: string;
  taskId?: string;
  exitCode?: number | null;
  error?: string;
  branch?: string;
  path?: string;
  depth?: number;
  wave?: number;
  output?: WorkflowStepRunOutput;
}

export interface ExecuteWorkflowResult {
  workflowId: string;
  name: string;
  runId?: string;
  results: WorkflowStepResult[];
}

export interface ExecuteWorkflowStartResult {
  runId: string;
  status: string;
  workflowId: string;
  name: string;
}

export type WorkflowRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface WorkflowStepRun {
  id: string;
  workflowRunId: string;
  flowPath: string | null;
  stepId: string;
  order: number;
  status: StepRunStatus;
  taskId?: string | null;
  exitCode?: number | null;
  error?: string | null;
  output?: WorkflowStepRunOutput | null;
  depth: number;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface WorkflowFlowRun {
  id: string;
  workflowRunId: string;
  path: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
}

export interface WorkflowRunListItem {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  triggerType?: string | null;
  triggerId?: string | null;
  startedAt: string;
  completedAt?: string | null;
  workflow: { id: string; name: string; isActive?: boolean };
  _count?: { stepRuns: number };
}

export interface WorkflowRunDetail {
  id: string;
  workflowId: string;
  userId: string;
  status: WorkflowRunStatus;
  triggerType?: string | null;
  startedAt: string;
  completedAt?: string | null;
  /** Snapshot biến workflow sau mỗi bước gán/đọc Excel. */
  variables?: Record<string, unknown> | null;
  workflow: { id: string; name: string };
  flows: WorkflowFlowRun[];
  stepRuns: WorkflowStepRun[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  variables?: Record<string, unknown>;
  graph?: { version: 2; edges: Array<{ from: string; to: string; handle?: string }> };
  graphEdges?: WorkflowGraphEdgeStored[];
  cronExpression?: string;
  stepDelayMs?: number;
  closeOpenedOnFinish?: boolean;
  isActive: boolean;
  steps?: WorkflowStep[];
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastExecutedAt?: string;
}

export interface AdminStats {
  users: { total: number; admins: number; active: number };
  agents: { total: number; online: number; offline: number; busy: number };
  tasks: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  workflows: { total: number; active: number };
  taskTrend: Array<{
    at: string;
    date: string;
    completed: number;
    failed: number;
  }>;
  subscriptions: {
    trial: number;
    active: number;
    expired: number;
    cancelled: number;
  };
  workflowRunsByTrigger: Array<{ triggerType: string; count: number }>;
  paymentTrend: Array<{ date: string; count: number; amountVnd: number }>;
  workflowRunsLast24h: number;
}

export interface AdminWorkflowRun {
  id: string;
  status: string;
  triggerType: string | null;
  triggerId: string | null;
  startedAt: string;
  completedAt: string | null;
  user: { id: string; email: string; name: string };
  workflow: { id: string; name: string; isActive: boolean };
}

export interface AdminPaymentRecord {
  id: string;
  amountVnd: number;
  status: string;
  orderCode: string;
  paymentCode: string;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string };
  plan: {
    id: string;
    name: string;
    durationDays: number;
    priceVnd: number;
  };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateAgentDto {
  name: string;
  os?: string;
  hostname?: string;
}

export interface CreateTaskDto {
  type: TaskType;
  agentId: string;
  command: string;
  timeout?: number;
  payload?: Record<string, unknown>;
  priority?: number;
}

export interface CreateTaskTemplateDto {
  name: string;
  type: TaskType;
  agentId: string;
  command: string;
  timeout?: number;
  priority?: number;
  payload?: Record<string, unknown>;
}

export interface CreateWorkflowDto {
  name: string;
  description?: string;
  variables?: Record<string, unknown>;
  graph?: { version: 2; edges: Array<{ from: string; to: string; handle?: string }> };
  graphEdges?: WorkflowGraphEdgeStored[];
  cronExpression?: string;
  stepDelayMs?: number;
  isActive?: boolean;
  steps: WorkflowStep[];
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role?: Role;
}

export interface UpdateUserDto {
  name?: string;
  role?: Role;
}
