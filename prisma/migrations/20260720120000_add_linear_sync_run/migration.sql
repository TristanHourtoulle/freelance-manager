-- Linear sync progress: DB-backed run rows so the client can poll the live
-- state of a background sync (Railway has no sticky sessions, so in-memory
-- progress is unsound). One row per triggered sync.

-- Enum
CREATE TYPE "LinearSyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- Sync runs
CREATE TABLE "linear_sync_runs" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "status"           "LinearSyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "totalMappings"    INTEGER NOT NULL DEFAULT 0,
  "doneMappings"     INTEGER NOT NULL DEFAULT 0,
  "currentLabel"     TEXT,
  "projectsUpserted" INTEGER NOT NULL DEFAULT 0,
  "tasksUpserted"    INTEGER NOT NULL DEFAULT 0,
  "errorMessage"     TEXT,
  "startedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"       TIMESTAMP(3),
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "linear_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "linear_sync_runs_userId_startedAt_idx" ON "linear_sync_runs"("userId", "startedAt");

-- Foreign keys
ALTER TABLE "linear_sync_runs"
  ADD CONSTRAINT "linear_sync_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
