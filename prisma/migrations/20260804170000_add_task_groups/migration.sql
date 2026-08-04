-- One-off, client-scoped task groups. A task has a single nullable group FK,
-- while the composite membership FK makes cross-user/cross-client membership
-- impossible at the database boundary.

CREATE TABLE "task_groups" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_groups_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tasks" ADD COLUMN "taskGroupId" TEXT;
ALTER TABLE "invoice_lines" ADD COLUMN "taskGroupId" TEXT;

CREATE UNIQUE INDEX "task_groups_id_userId_clientId_key"
  ON "task_groups"("id", "userId", "clientId");
CREATE INDEX "task_groups_userId_invoiceId_idx"
  ON "task_groups"("userId", "invoiceId");
CREATE INDEX "task_groups_userId_clientId_invoiceId_idx"
  ON "task_groups"("userId", "clientId", "invoiceId");
CREATE INDEX "task_groups_clientId_idx" ON "task_groups"("clientId");
CREATE INDEX "tasks_taskGroupId_idx" ON "tasks"("taskGroupId");
CREATE INDEX "tasks_userId_clientId_taskGroupId_idx"
  ON "tasks"("userId", "clientId", "taskGroupId");
CREATE INDEX "invoice_lines_taskGroupId_idx"
  ON "invoice_lines"("taskGroupId");

ALTER TABLE "task_groups"
  ADD CONSTRAINT "task_groups_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_groups"
  ADD CONSTRAINT "task_groups_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_groups"
  ADD CONSTRAINT "task_groups_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_taskGroupId_userId_clientId_fkey"
  FOREIGN KEY ("taskGroupId", "userId", "clientId")
  REFERENCES "task_groups"("id", "userId", "clientId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_lines"
  ADD CONSTRAINT "invoice_lines_taskGroupId_fkey"
  FOREIGN KEY ("taskGroupId") REFERENCES "task_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
