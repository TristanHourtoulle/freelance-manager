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

-- ---------------------------------------------------------------------------
-- DO NOT DELETE — intentionally invisible to schema.prisma.
--
-- Partial unique index: at most one RUNNING run per user. syncFromLinear is
-- not safe to run twice concurrently (two passes race on the same project and
-- task upserts), and the route's check-then-act pre-check cannot close the
-- race on its own — two POSTs on separate instances can both observe no
-- RUNNING row. This index makes the database itself the arbiter; the loser of
-- the race fails with Prisma P2002, which the route maps to a friendly 409.
--
-- Prisma cannot express a partial (filtered) index in schema.prisma, so this
-- lives ONLY here. `prisma migrate diff` will therefore report it as drift
-- against the datamodel forever, and `prisma db push` will not create it.
-- That drift is expected — do not "resolve" it by dropping this index.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "linear_sync_runs_userId_running_key"
  ON "linear_sync_runs"("userId")
  WHERE "status" = 'RUNNING';

-- Foreign keys
ALTER TABLE "linear_sync_runs"
  ADD CONSTRAINT "linear_sync_runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
