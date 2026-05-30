DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TaskType'
      AND e.enumlabel = 'SCREEN_CAPTURE'
  ) THEN
    ALTER TYPE "TaskType" ADD VALUE 'SCREEN_CAPTURE';
  END IF;
END $$;
