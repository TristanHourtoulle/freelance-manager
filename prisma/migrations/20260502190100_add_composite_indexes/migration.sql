-- Composite + partial indexes targeting the hot read paths in
-- /api/dashboard, /api/analytics, /api/nav-counts, /api/clients, /api/invoices.

-- Project: nav-counts WHERE userId AND status='ACTIVE'
CREATE INDEX IF NOT EXISTS "projects_userId_status_idx"
  ON "projects"("userId", "status");

-- Task: nav-counts (userId, status) + dashboard recent tasks (userId, completedAt)
CREATE INDEX IF NOT EXISTS "tasks_userId_status_idx"
  ON "tasks"("userId", "status");
CREATE INDEX IF NOT EXISTS "tasks_invoiceId_userId_idx"
  ON "tasks"("invoiceId", "userId");
-- Partial index for analytics (only completed tasks have a non-null completedAt)
CREATE INDEX IF NOT EXISTS "tasks_userId_completedAt_done_idx"
  ON "tasks"("userId", "completedAt" DESC)
  WHERE "completedAt" IS NOT NULL;

-- Invoice: nav-counts (userId, status, paymentStatus) + list orderings
CREATE INDEX IF NOT EXISTS "invoices_userId_status_paymentStatus_idx"
  ON "invoices"("userId", "status", "paymentStatus");
CREATE INDEX IF NOT EXISTS "invoices_userId_issueDate_desc_idx"
  ON "invoices"("userId", "issueDate" DESC);

-- Payment: dashboard / analytics monthly aggregations
CREATE INDEX IF NOT EXISTS "payments_userId_paidAt_idx"
  ON "payments"("userId", "paidAt");

-- Client: list endpoint WHERE userId AND archivedAt IS NULL ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS "clients_userId_createdAt_active_idx"
  ON "clients"("userId", "createdAt" DESC)
  WHERE "archivedAt" IS NULL;
