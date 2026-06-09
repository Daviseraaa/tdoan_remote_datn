-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'CLOSE_APP';

-- AlterTable
ALTER TABLE "workflows" ADD COLUMN "closeOpenedOnFinish" BOOLEAN NOT NULL DEFAULT false;
