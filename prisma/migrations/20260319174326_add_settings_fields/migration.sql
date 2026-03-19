-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "defaultPaymentDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "defaultRate" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "linearApiTokenEncrypted" BYTEA,
ADD COLUMN     "linearApiTokenIv" BYTEA,
ADD COLUMN     "notificationPrefs" JSONB,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system';
