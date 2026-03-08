-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_OVERDUE';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paymentDueDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "invoice_files" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "fileData" BYTEA NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_files_invoiceId_idx" ON "invoice_files"("invoiceId");

-- AddForeignKey
ALTER TABLE "invoice_files" ADD CONSTRAINT "invoice_files_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
