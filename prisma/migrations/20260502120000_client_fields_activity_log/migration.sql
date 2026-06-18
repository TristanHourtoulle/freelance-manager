-- New optional Client fields
ALTER TABLE "clients"
  ADD COLUMN "website" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "notes"   TEXT,
  ADD COLUMN "starred" BOOLEAN NOT NULL DEFAULT false;

-- ActivityKind enum
CREATE TYPE "ActivityKind" AS ENUM (
  'CLIENT_CREATED',
  'CLIENT_UPDATED',
  'CLIENT_ARCHIVED',
  'CLIENT_DUPLICATED',
  'INVOICE_CREATED',
  'INVOICE_SENT',
  'INVOICE_CANCELLED',
  'PAYMENT_RECORDED',
  'PAYMENT_DELETED',
  'TASKS_PENDING',
  'LINEAR_SYNCED'
);

-- ActivityLog table
CREATE TABLE "activity_log" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "clientId"  TEXT,
  "invoiceId" TEXT,
  "projectId" TEXT,
  "kind"      "ActivityKind" NOT NULL,
  "title"     TEXT NOT NULL,
  "meta"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_log_userId_createdAt_idx"   ON "activity_log"("userId", "createdAt");
CREATE INDEX "activity_log_clientId_createdAt_idx" ON "activity_log"("clientId", "createdAt");

ALTER TABLE "activity_log"
  ADD CONSTRAINT "activity_log_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "users"("id")    ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "activity_log_clientId_fkey"  FOREIGN KEY ("clientId")  REFERENCES "clients"("id")  ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "activity_log_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "activity_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
