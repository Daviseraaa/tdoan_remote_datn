-- Khoảng cách mặc định (ms) sau mỗi bước workflow
ALTER TABLE "workflows" ADD COLUMN "stepDelayMs" INTEGER NOT NULL DEFAULT 0;
