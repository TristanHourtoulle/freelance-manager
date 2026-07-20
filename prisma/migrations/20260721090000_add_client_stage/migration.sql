-- Commercial lifecycle of a client, orthogonal to archivedAt.
-- LEAD   = prospect, not signed: excluded from nav counts and revenue averages.
-- ACTIVE = signed, currently billable.
-- DORMANT = signed in the past, no current engagement.
-- Existing rows default to ACTIVE so no historical KPI shifts.

DO $$ BEGIN
  CREATE TYPE "ClientStage" AS ENUM ('LEAD', 'ACTIVE', 'DORMANT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "stage" "ClientStage" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX IF NOT EXISTS "clients_userId_stage_idx" ON "clients"("userId", "stage");
