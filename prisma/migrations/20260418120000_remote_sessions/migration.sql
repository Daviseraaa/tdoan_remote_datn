-- CreateEnum
CREATE TYPE "RemoteSessionStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED', 'FAILED');

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
CREATE INDEX "remote_sessions_agentId_status_idx" ON "remote_sessions"("agentId", "status");

-- CreateIndex
CREATE INDEX "remote_sessions_operatorId_idx" ON "remote_sessions"("operatorId");

-- AddForeignKey
ALTER TABLE "remote_sessions" ADD CONSTRAINT "remote_sessions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_sessions" ADD CONSTRAINT "remote_sessions_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
