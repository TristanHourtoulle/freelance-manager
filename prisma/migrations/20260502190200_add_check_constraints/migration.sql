-- DB-level invariants for monetary fields, date ordering, and the
-- linear_mappings team-or-project XOR. Zod still enforces these at
-- the API layer; these constraints are the safety net for raw SQL
-- and future automation that bypasses the request handlers.

-- Drop first if a previous run left them lying around (defensive)
ALTER TABLE invoices       DROP CONSTRAINT IF EXISTS invoices_totals_nonneg;
ALTER TABLE invoices       DROP CONSTRAINT IF EXISTS invoices_due_after_issue;
ALTER TABLE invoice_lines  DROP CONSTRAINT IF EXISTS invoice_lines_qty_position_nonneg;
ALTER TABLE payments       DROP CONSTRAINT IF EXISTS payments_amount_positive;
ALTER TABLE clients        DROP CONSTRAINT IF EXISTS clients_rates_nonneg;
ALTER TABLE linear_mappings DROP CONSTRAINT IF EXISTS linear_mappings_team_or_project;

ALTER TABLE invoices ADD CONSTRAINT invoices_totals_nonneg
  CHECK (subtotal >= 0 AND total >= 0 AND tax >= 0
         AND ("totalOverride" IS NULL OR "totalOverride" >= 0));

ALTER TABLE invoices ADD CONSTRAINT invoices_due_after_issue
  CHECK ("dueDate" >= "issueDate");

ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_qty_position_nonneg
  CHECK (qty >= 0 AND position >= 0);

ALTER TABLE payments ADD CONSTRAINT payments_amount_positive
  CHECK (amount > 0);

ALTER TABLE clients ADD CONSTRAINT clients_rates_nonneg
  CHECK ((rate IS NULL OR rate >= 0)
         AND ("fixedPrice" IS NULL OR "fixedPrice" >= 0)
         AND (deposit IS NULL OR deposit >= 0));

ALTER TABLE linear_mappings ADD CONSTRAINT linear_mappings_team_or_project
  CHECK ("linearTeamId" IS NOT NULL OR "linearProjectId" IS NOT NULL);
