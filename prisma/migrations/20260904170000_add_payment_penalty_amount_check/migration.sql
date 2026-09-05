-- Defense-in-depth for the `"penaltyAmount" <= amount` invariant on a
-- Payment row, joining the other DB-level invariants added in
-- 20260502190200_add_check_constraints (e.g. payments_amount_positive) as
-- the safety net for raw SQL and future automation that bypasses the
-- request handlers. Application code already enforces this at both write
-- paths (isPenaltyWithinAmount, used by paymentCreateSchema on POST and by
-- the PATCH handler on update, which now also selects penaltyAmount to
-- check against), but nothing previously stopped a lower-level write from
-- breaking it silently.
--
-- Prisma ORM does not support CHECK constraints natively in schema.prisma
-- or Prisma Migrate (as of Prisma 7): they are supported at the database
-- level and by Prisma Client, so this constraint intentionally has no
-- `@@check` counterpart in schema.prisma and lives only here.
--
-- Verified against the local dataset before authoring this migration: 0 of
-- 3 existing "payments" rows violate `"penaltyAmount" <= amount`.
--
-- Drop first if a previous run left it lying around (defensive, matching
-- 20260502190200's convention), then add NOT VALID and validate in a
-- separate statement: this avoids taking a table-scanning ACCESS EXCLUSIVE
-- lock on "payments" in one shot, so the migration stays safe to run
-- against a populated, live table — the constraint is enforced for all new
-- writes as soon as it is added, and the VALIDATE step (a lighter lock,
-- allowing concurrent reads and writes) confirms every existing row
-- already complies.

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_penalty_lte_amount;

ALTER TABLE payments
  ADD CONSTRAINT payments_penalty_lte_amount
  CHECK ("penaltyAmount" <= amount) NOT VALID;

ALTER TABLE payments
  VALIDATE CONSTRAINT payments_penalty_lte_amount;
