-- Dev DB có thể đã có BROWSER_AUTOMATION từ migration thử nghiệm; đổi tên → CHROME_EXTENSION.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskType'
      AND e.enumlabel = 'BROWSER_AUTOMATION'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskType'
      AND e.enumlabel = 'CHROME_EXTENSION'
  ) THEN
    ALTER TYPE "TaskType" RENAME VALUE 'BROWSER_AUTOMATION' TO 'CHROME_EXTENSION';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskType'
      AND e.enumlabel = 'CHROME_EXTENSION'
  ) THEN
    ALTER TYPE "TaskType" ADD VALUE 'CHROME_EXTENSION';
  END IF;
END $$;
