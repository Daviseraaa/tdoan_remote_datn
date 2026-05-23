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

-- CreateIndex
CREATE INDEX "task_templates_userId_idx" ON "task_templates"("userId");

-- CreateIndex
CREATE INDEX "task_templates_agentId_idx" ON "task_templates"("agentId");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
