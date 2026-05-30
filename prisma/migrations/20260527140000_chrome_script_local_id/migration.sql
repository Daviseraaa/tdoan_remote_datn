-- AlterTable
ALTER TABLE "chrome_scripts" ADD COLUMN "localId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chrome_script_agent_local" ON "chrome_scripts"("userId", "agentId", "localId");
