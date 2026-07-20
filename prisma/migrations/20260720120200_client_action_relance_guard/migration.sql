-- Auto-relance idempotency guard.
--
-- Overdue invoices lazily spawn a RELANCE follow-up action when the dashboard
-- is read. The database itself must be the guard against duplicates: a
-- read-then-write check cannot close the race between two concurrent reads.
--
-- A nullable UNIQUE scalar column (not a partial index) is used so Prisma can
-- express it in schema.prisma and `db push` never silently drops it. Postgres
-- allows unlimited NULLs in a unique index, so manual actions (NULL) stay
-- unconstrained while an invoice can only ever spawn one auto-relance.

ALTER TABLE "client_actions"
  ADD COLUMN IF NOT EXISTS "relanceInvoiceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "client_actions_relanceInvoiceId_key"
  ON "client_actions"("relanceInvoiceId");
