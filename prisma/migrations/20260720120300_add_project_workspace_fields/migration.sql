-- App-owned workspace fields on a project.
--
-- These four columns are NOT mirrored from Linear. They are typed by the user
-- and must survive every sync: see LINEAR_MIRRORED_PROJECT_FIELDS in
-- src/lib/linear.ts, which is the whitelist the sync upserts are allowed to
-- write. All nullable so existing rows need no backfill.

ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "repoUrl" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "stagingUrl" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "prodUrl" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "runbook" TEXT;
