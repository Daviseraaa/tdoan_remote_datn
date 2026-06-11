-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('COMMAND', 'SCRIPT', 'FILE_OPERATION', 'SYSTEM_INFO', 'OPEN_APP', 'OPEN_BROWSER', 'CLOSE_APP', 'DESKTOP_AUTOMATION', 'CHROME_EXTENSION', 'SCREEN_CAPTURE', 'HTTP_REQUEST', 'TELEGRAM_SEND');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('COMMAND', 'SCRIPT', 'DELAY', 'CONDITION', 'LOOP', 'VARIABLE', 'EXCEL', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'SCHEDULE', 'TELEGRAM');

-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('CRON', 'INTERVAL', 'DAILY', 'HOURLY', 'ONCE');

-- CreateEnum
CREATE TYPE "TriggerExecutionStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "OnFailure" AS ENUM ('STOP', 'SKIP', 'RETRY');

-- CreateEnum
CREATE TYPE "RemoteSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FlowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "StepRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('SEPAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalPriceVnd" INTEGER NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "maxAgents" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amountVnd" INTEGER NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'SEPAY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "orderCode" BIGINT NOT NULL,
    "paymentCode" TEXT NOT NULL,
    "sepayTransactionId" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "googleId" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "planId" TEXT,
    "trialUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "os" TEXT,
    "hostname" TEXT,
    "ip" TEXT,
    "metadata" JSONB,
    "chromeProfiles" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desktop_recordings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'recorded',
    "localId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "desktop_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chrome_scripts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startUrl" TEXT,
    "steps" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'recorded',
    "localId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "chrome_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "command" TEXT NOT NULL,
    "payload" JSONB,
    "timeout" INTEGER NOT NULL DEFAULT 300000,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "command" TEXT,
    "payload" JSONB,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "exitCode" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "timeout" INTEGER NOT NULL DEFAULT 300000,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workflowRunId" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variables" JSONB,
    "graph" JSONB,
    "graphEdges" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cronExpression" TEXT,
    "stepDelayMs" INTEGER NOT NULL DEFAULT 0,
    "closeOpenedOnFinish" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "botToken" TEXT NOT NULL,
    "botUsername" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'webhook',
    "webhookSecret" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "telegram_bots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "type" "WorkflowTriggerType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "scheduleKind" "ScheduleKind",
    "cronExpression" TEXT,
    "intervalSeconds" INTEGER,
    "runAt" TIMESTAMP(3),
    "dailyHour" INTEGER,
    "dailyMinute" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastWorkflowRunId" TEXT,
    "maxRetries" INTEGER NOT NULL DEFAULT 0,
    "retryDelaySeconds" INTEGER NOT NULL DEFAULT 60,
    "telegramBotId" TEXT,
    "matchConfig" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_executions" (
    "id" TEXT NOT NULL,
    "status" "TriggerExecutionStatus" NOT NULL DEFAULT 'STARTED',
    "payload" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "triggerId" TEXT NOT NULL,
    "workflowRunId" TEXT,

    CONSTRAINT "trigger_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "variables" JSONB,
    "triggerId" TEXT,
    "triggerType" "WorkflowTriggerType",
    "triggerPayload" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_flow_runs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" "FlowRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_flow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_step_runs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "flowPath" TEXT,
    "stepId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "StepRunStatus" NOT NULL DEFAULT 'PENDING',
    "taskId" TEXT,
    "exitCode" INTEGER,
    "error" TEXT,
    "output" JSONB,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_steps" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "StepType" NOT NULL,
    "config" JSONB NOT NULL,
    "onFailure" "OnFailure" NOT NULL DEFAULT 'STOP',
    "workflowId" TEXT NOT NULL,

    CONSTRAINT "workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_sessions" (
    "id" TEXT NOT NULL,
    "status" "RemoteSessionStatus" NOT NULL DEFAULT 'PENDING',
    "controlMode" TEXT NOT NULL DEFAULT 'full',
    "lastHeartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "agentId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,

    CONSTRAINT "remote_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderCode_key" ON "payments"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentCode_key" ON "payments"("paymentCode");

-- CreateIndex
CREATE UNIQUE INDEX "payments_sepayTransactionId_key" ON "payments"("sepayTransactionId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE INDEX "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");

-- CreateIndex
CREATE INDEX "users_subscriptionExpiresAt_idx" ON "users"("subscriptionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "agents_agentKey_key" ON "agents"("agentKey");

-- CreateIndex
CREATE INDEX "agents_userId_idx" ON "agents"("userId");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "desktop_recordings_userId_idx" ON "desktop_recordings"("userId");

-- CreateIndex
CREATE INDEX "desktop_recordings_agentId_idx" ON "desktop_recordings"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "desktop_recordings_userId_agentId_localId_key" ON "desktop_recordings"("userId", "agentId", "localId");

-- CreateIndex
CREATE INDEX "chrome_scripts_userId_idx" ON "chrome_scripts"("userId");

-- CreateIndex
CREATE INDEX "chrome_scripts_agentId_idx" ON "chrome_scripts"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "chrome_scripts_userId_agentId_localId_key" ON "chrome_scripts"("userId", "agentId", "localId");

-- CreateIndex
CREATE INDEX "task_templates_userId_idx" ON "task_templates"("userId");

-- CreateIndex
CREATE INDEX "task_templates_agentId_idx" ON "task_templates"("agentId");

-- CreateIndex
CREATE INDEX "tasks_userId_idx" ON "tasks"("userId");

-- CreateIndex
CREATE INDEX "tasks_agentId_idx" ON "tasks"("agentId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "task_logs_taskId_idx" ON "task_logs"("taskId");

-- CreateIndex
CREATE INDEX "workflows_userId_idx" ON "workflows"("userId");

-- CreateIndex
CREATE INDEX "telegram_bots_userId_idx" ON "telegram_bots"("userId");

-- CreateIndex
CREATE INDEX "workflow_triggers_userId_idx" ON "workflow_triggers"("userId");

-- CreateIndex
CREATE INDEX "workflow_triggers_workflowId_idx" ON "workflow_triggers"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_triggers_type_enabled_idx" ON "workflow_triggers"("type", "enabled");

-- CreateIndex
CREATE INDEX "workflow_triggers_nextRunAt_idx" ON "workflow_triggers"("nextRunAt");

-- CreateIndex
CREATE INDEX "workflow_triggers_telegramBotId_idx" ON "workflow_triggers"("telegramBotId");

-- CreateIndex
CREATE INDEX "trigger_executions_triggerId_idx" ON "trigger_executions"("triggerId");

-- CreateIndex
CREATE INDEX "trigger_executions_startedAt_idx" ON "trigger_executions"("startedAt");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowId_idx" ON "workflow_runs"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_runs_userId_idx" ON "workflow_runs"("userId");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_flow_runs_workflowRunId_idx" ON "workflow_flow_runs"("workflowRunId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_flow_runs_workflowRunId_path_key" ON "workflow_flow_runs"("workflowRunId", "path");

-- CreateIndex
CREATE INDEX "workflow_step_runs_workflowRunId_idx" ON "workflow_step_runs"("workflowRunId");

-- CreateIndex
CREATE INDEX "workflow_step_runs_stepId_idx" ON "workflow_step_runs"("stepId");

-- CreateIndex
CREATE INDEX "workflow_step_runs_taskId_idx" ON "workflow_step_runs"("taskId");

-- CreateIndex
CREATE INDEX "workflow_steps_workflowId_idx" ON "workflow_steps"("workflowId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "remote_sessions_agentId_status_idx" ON "remote_sessions"("agentId", "status");

-- CreateIndex
CREATE INDEX "remote_sessions_operatorId_idx" ON "remote_sessions"("operatorId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_recordings" ADD CONSTRAINT "desktop_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_recordings" ADD CONSTRAINT "desktop_recordings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chrome_scripts" ADD CONSTRAINT "chrome_scripts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chrome_scripts" ADD CONSTRAINT "chrome_scripts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_telegramBotId_fkey" FOREIGN KEY ("telegramBotId") REFERENCES "telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trigger_executions" ADD CONSTRAINT "trigger_executions_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "workflow_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_flow_runs" ADD CONSTRAINT "workflow_flow_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_sessions" ADD CONSTRAINT "remote_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_sessions" ADD CONSTRAINT "remote_sessions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
