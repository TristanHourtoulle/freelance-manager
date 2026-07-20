-- Linear dates the sync previously discarded: the issue's due date and the
-- project's estimated start / target completion dates. All nullable: Linear
-- leaves them unset far more often than not.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "targetDate" TIMESTAMP(3);

-- Capacity input for the queued-days figures. 5 matches a standard week and
-- keeps every existing row valid.
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "workingDaysPerWeek" INTEGER NOT NULL DEFAULT 5;
