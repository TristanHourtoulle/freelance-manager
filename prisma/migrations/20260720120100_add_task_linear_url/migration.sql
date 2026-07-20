-- Deep link to the Linear issue (Issue.url from the Linear GraphQL API).
-- Nullable: rows synced before this migration keep NULL until the next sync,
-- and the UI falls back to plain text for them.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "linearUrl" TEXT;
