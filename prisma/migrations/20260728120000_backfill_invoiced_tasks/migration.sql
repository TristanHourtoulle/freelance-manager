-- Data repair: attach tasks that were invoiced through their invoice line but
-- never marked as invoiced.
--
-- Bug (fixed in application code by commit 9936eb6): when an invoice was
-- created, "invoice_lines"."taskId" was persisted for every line built from a
-- task, but the task itself was only updated ("invoiceId" set + status DONE)
-- when its id ALSO appeared in the request's explicit taskIds array. Tasks
-- referenced only through a line stayed at status PENDING_INVOICE with
-- "invoiceId" NULL forever, so already-billed work kept inflating the user's
-- pipeline figure. The code fix does not repair existing rows; this migration
-- does.
--
-- Rules applied below:
-- * Target only tasks with "invoiceId" IS NULL whose id appears as an invoice
--   line's "taskId". A task that already has an "invoiceId" is never touched,
--   so no task is ever re-pointed from one invoice to another.
-- * Mirror the application's attach behaviour: set "invoiceId" to the invoice
--   owning the line and set status to DONE (and bump "updatedAt", as the ORM
--   would).
-- * Determinism guard: if a task is referenced by lines on more than one
--   invoice, pick the earliest-issued invoice ("issueDate" ASC), tie-broken by
--   invoice "id" ASC — enforced by DISTINCT ON + ORDER BY, never left to the
--   planner's arbitrary choice.
-- * Ownership integrity: only attach when the invoice and the task share the
--   same "userId" AND the same "clientId"; any mismatch is skipped.
-- * CANCELLED invoices are excluded: the application treats them as
--   non-billing (payments are refused, edit/delete detach their tasks), so a
--   task whose only referencing line sits on a cancelled invoice legitimately
--   remains in the pipeline.
-- * Idempotent: the first run fills "invoiceId", which removes the row from
--   the "invoiceId" IS NULL target set; a second run updates 0 rows.

UPDATE "tasks" AS t
SET
  "invoiceId" = pick."invoiceId",
  "status"    = 'DONE'::"TaskStatus",
  "updatedAt" = NOW()
FROM (
  SELECT DISTINCT ON (il."taskId")
    il."taskId",
    il."invoiceId"
  FROM "invoice_lines" il
  JOIN "invoices" i  ON i."id"  = il."invoiceId"
  JOIN "tasks"    tk ON tk."id" = il."taskId"
  WHERE il."taskId" IS NOT NULL
    AND tk."invoiceId" IS NULL
    AND i."status" <> 'CANCELLED'
    AND i."userId" = tk."userId"
    AND i."clientId" = tk."clientId"
  ORDER BY il."taskId", i."issueDate" ASC, i."id" ASC
) AS pick
WHERE t."id" = pick."taskId"
  AND t."invoiceId" IS NULL;
