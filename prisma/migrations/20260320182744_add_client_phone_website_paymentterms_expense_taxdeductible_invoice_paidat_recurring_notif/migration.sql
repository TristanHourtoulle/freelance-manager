-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RECURRING_EXPENSE';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "paymentTerms" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "taxDeductible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paidAt" TIMESTAMP(3);
