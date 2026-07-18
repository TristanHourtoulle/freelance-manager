-- Drop the redundant Task(userId, completedAt DESC) full index added in TRI-1044.
-- The partial index "tasks_userId_completedAt_done_idx"
-- (WHERE "completedAt" IS NOT NULL, from 20260502190100_add_composite_indexes)
-- already covers the dashboard/analytics workload, which always filters
-- completedAt as not-null / >= a bound. The full index only added write
-- amplification on Task bulk writes.

DROP INDEX IF EXISTS "tasks_userId_completedAt_idx";
