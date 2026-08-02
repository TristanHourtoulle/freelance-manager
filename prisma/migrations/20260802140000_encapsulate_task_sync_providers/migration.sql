-- Make sync runs provider-aware while preserving all existing Linear rows.
ALTER TABLE "linear_sync_runs"
  ADD COLUMN "providerId" TEXT NOT NULL DEFAULT 'linear';

DROP INDEX IF EXISTS "linear_sync_runs_userId_startedAt_idx";
CREATE INDEX "linear_sync_runs_userId_providerId_startedAt_idx"
  ON "linear_sync_runs"("userId", "providerId", "startedAt");

DROP INDEX IF EXISTS "linear_sync_runs_userId_running_key";
CREATE UNIQUE INDEX "task_sync_runs_userId_providerId_running_key"
  ON "linear_sync_runs"("userId", "providerId")
  WHERE "status" = 'RUNNING';

ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'TASKS_SYNCED';
