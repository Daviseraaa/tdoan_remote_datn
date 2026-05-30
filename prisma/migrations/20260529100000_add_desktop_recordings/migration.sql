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

-- CreateIndex
CREATE INDEX "desktop_recordings_userId_idx" ON "desktop_recordings"("userId");

-- CreateIndex
CREATE INDEX "desktop_recordings_agentId_idx" ON "desktop_recordings"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "desktop_recording_agent_local" ON "desktop_recordings"("userId", "agentId", "localId");

-- AddForeignKey
ALTER TABLE "desktop_recordings" ADD CONSTRAINT "desktop_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desktop_recordings" ADD CONSTRAINT "desktop_recordings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
