-- Real effort spent per task, in days, entered by the freelancer.
-- Mirrors the precision of the Linear-sourced "estimate" column so the two are
-- interchangeable as the denominator of the effective daily rate.

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "actualDays" DECIMAL(6,2);
