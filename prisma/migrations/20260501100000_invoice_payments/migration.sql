-- New PaymentStatus enum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID');

-- Add CANCELLED to InvoiceStatus enum (PAID and OVERDUE stay temporarily for backfill)
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- New paymentStatus column on invoices (default UNPAID)
ALTER TABLE "invoices" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- Payments table
CREATE TABLE "payments" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount"    DECIMAL(10,2) NOT NULL,
  "paidAt"    TIMESTAMP(3) NOT NULL,
  "method"    TEXT,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_userId_idx"    ON "payments"("userId");
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");
CREATE INDEX "payments_paidAt_idx"    ON "payments"("paidAt");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "users"("id")    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: each PAID invoice → 1 Payment row + paymentStatus=PAID
INSERT INTO "payments" ("id", "userId", "invoiceId", "amount", "paidAt", "createdAt", "updatedAt")
SELECT
  'pmt_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
  i."userId",
  i.id,
  i.total,
  COALESCE(i."paidAt", i."updatedAt"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "invoices" i
WHERE i.status = 'PAID';

UPDATE "invoices" SET "paymentStatus" = 'PAID' WHERE status = 'PAID';

-- Migrate document statuses: PAID/OVERDUE collapse into SENT (overdue is now computed)
UPDATE "invoices" SET status = 'SENT' WHERE status IN ('PAID', 'OVERDUE');

-- Drop legacy paidAt column on invoices (now derived from payments)
ALTER TABLE "invoices" DROP COLUMN "paidAt";

-- Recreate InvoiceStatus enum without legacy values
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'CANCELLED');
ALTER TABLE "invoices"
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "InvoiceStatus" USING status::text::"InvoiceStatus",
  ALTER COLUMN status SET DEFAULT 'DRAFT';
DROP TYPE "InvoiceStatus_old";
