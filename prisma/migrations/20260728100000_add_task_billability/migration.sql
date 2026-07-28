-- Billability flag on tasks. Tasks are billable by default; marking one
-- non-billable requires a structured reason (bug fix already invoiced,
-- non-billed work, commercial gesture, other + free-text note) and records
-- when the exclusion happened. The composite index backs the pipeline gate
-- (userId, status, billable).

DO $$ BEGIN
  CREATE TYPE "NonBillableReason" AS ENUM (
    'BUG_FIX_ALREADY_INVOICED',
    'NON_BILLED_WORK',
    'COMMERCIAL_GESTURE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "billable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "nonBillableReason" "NonBillableReason";
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "nonBillableNote" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "nonBillableAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "tasks_userId_status_billable_idx" ON "tasks"("userId", "status", "billable");
