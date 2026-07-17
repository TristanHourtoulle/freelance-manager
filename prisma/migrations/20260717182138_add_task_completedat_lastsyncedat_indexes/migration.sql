-- Additional composite indexes on the tasks hot read paths.
-- Mirrors the @@index directives added to the Task model in schema.prisma.

-- Dashboard recent tasks + analytics period filter
--   (/api/dashboard, /api/analytics WHERE userId ... ORDER BY completedAt DESC)
CREATE INDEX IF NOT EXISTS "tasks_userId_completedAt_idx"
  ON "tasks"("userId", "completedAt" DESC);

-- Client detail task list ordering
--   (/api/clients/[id] ORDER BY lastSyncedAt DESC)
CREATE INDEX IF NOT EXISTS "tasks_clientId_lastSyncedAt_idx"
  ON "tasks"("clientId", "lastSyncedAt" DESC);
