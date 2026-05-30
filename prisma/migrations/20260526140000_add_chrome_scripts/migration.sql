-- CreateTable
CREATE TABLE "chrome_scripts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startUrl" TEXT,
    "steps" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'recorded',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "chrome_scripts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chrome_scripts_userId_idx" ON "chrome_scripts"("userId");

-- CreateIndex
CREATE INDEX "chrome_scripts_agentId_idx" ON "chrome_scripts"("agentId");

-- AddForeignKey
ALTER TABLE "chrome_scripts" ADD CONSTRAINT "chrome_scripts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chrome_scripts" ADD CONSTRAINT "chrome_scripts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
