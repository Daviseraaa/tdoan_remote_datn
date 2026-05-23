-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "FlowRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'STOPPED');
CREATE TYPE "StepRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'PENDING',
    "variables" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_flow_runs" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status" "FlowRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_flow_runs_pkey" PRIMARY KEY ("id")
);

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
    "depth" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_step_runs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "workflowRunId" TEXT;

-- CreateIndex
CREATE INDEX "workflow_runs_workflowId_idx" ON "workflow_runs"("workflowId");
CREATE INDEX "workflow_runs_userId_idx" ON "workflow_runs"("userId");
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE UNIQUE INDEX "workflow_flow_runs_workflowRunId_path_key" ON "workflow_flow_runs"("workflowRunId", "path");
CREATE INDEX "workflow_flow_runs_workflowRunId_idx" ON "workflow_flow_runs"("workflowRunId");
CREATE INDEX "workflow_step_runs_workflowRunId_idx" ON "workflow_step_runs"("workflowRunId");
CREATE INDEX "workflow_step_runs_stepId_idx" ON "workflow_step_runs"("stepId");
CREATE INDEX "workflow_step_runs_taskId_idx" ON "workflow_step_runs"("taskId");
CREATE INDEX "tasks_workflowRunId_idx" ON "tasks"("workflowRunId");

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_flow_runs" ADD CONSTRAINT "workflow_flow_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_step_runs" ADD CONSTRAINT "workflow_step_runs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
