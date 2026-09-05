-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "lateFeeClaimedAt" TIMESTAMP(3),
ADD COLUMN     "lateFeeFixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lateFeeInterest" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "penaltyAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "lateFeeAnnualRate" DECIMAL(6,4) NOT NULL DEFAULT 0.10,
ADD COLUMN     "lateFeeFixedAmount" DECIMAL(10,2) NOT NULL DEFAULT 40;
