-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "rate" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "totalAmount" SET DATA TYPE DECIMAL(10,2);

-- AlterTable
ALTER TABLE "task_overrides" ALTER COLUMN "rateOverride" SET DATA TYPE DECIMAL(10,2);
