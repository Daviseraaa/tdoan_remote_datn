-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('MANUAL', 'SCHEDULE', 'TELEGRAM');
CREATE TYPE "ScheduleKind" AS ENUM ('CRON', 'INTERVAL', 'DAILY', 'HOURLY', 'ONCE');
CREATE TYPE "TriggerExecutionStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'SKIPPED');

-- AlterEnum
ALTER TYPE "StepType" ADD VALUE 'TELEGRAM';

-- AlterTable
ALTER TABLE "workflow_runs" ADD COLUMN "triggerId" TEXT,
ADD COLUMN "triggerType" "WorkflowTriggerType",
ADD COLUMN "triggerPayload" JSONB;

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

-- CreateIndex
CREATE INDEX "telegram_bots_userId_idx" ON "telegram_bots"("userId");
CREATE INDEX "workflow_triggers_userId_idx" ON "workflow_triggers"("userId");
CREATE INDEX "workflow_triggers_workflowId_idx" ON "workflow_triggers"("workflowId");
CREATE INDEX "workflow_triggers_type_enabled_idx" ON "workflow_triggers"("type", "enabled");
CREATE INDEX "workflow_triggers_nextRunAt_idx" ON "workflow_triggers"("nextRunAt");
CREATE INDEX "workflow_triggers_telegramBotId_idx" ON "workflow_triggers"("telegramBotId");
CREATE INDEX "trigger_executions_triggerId_idx" ON "trigger_executions"("triggerId");
CREATE INDEX "trigger_executions_startedAt_idx" ON "trigger_executions"("startedAt");

-- AddForeignKey
ALTER TABLE "telegram_bots" ADD CONSTRAINT "telegram_bots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_telegramBotId_fkey" FOREIGN KEY ("telegramBotId") REFERENCES "telegram_bots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trigger_executions" ADD CONSTRAINT "trigger_executions_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "workflow_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
