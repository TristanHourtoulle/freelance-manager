import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { NextResponse } from "next/server"

/** French law requires invoices to be retained for 10 years. */
const INVOICE_RETENTION_YEARS = 10

/**
 * DELETE /api/user/data-delete
 * Deletes all user data for GDPR compliance (right to erasure).
 * Invoices within the legal retention period (10 years) are anonymized
 * instead of deleted: client references are cleared but financial data is kept.
 * Runs in a transaction to guarantee atomicity.
 *
 * @returns 200 - `{ message, retainedInvoices }`
 * @throws 401 - Unauthenticated request
 */
export async function DELETE(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    // Log before deletion (audit log will be deleted in the transaction)
    logAudit({
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "UserData",
      metadata: { reason: "GDPR right to erasure" },
    })

    // Count invoices that fall under retention period
    const retentionCutoff = new Date()
    retentionCutoff.setFullYear(
      retentionCutoff.getFullYear() - INVOICE_RETENTION_YEARS,
    )

    const retainedCount = await prisma.invoice.count({
      where: {
        client: { userId },
        createdAt: { gte: retentionCutoff },
      },
    })

    await prisma.$transaction(async (tx) => {
      // Delete independent records first
      await tx.auditLog.deleteMany({ where: { userId } })
      await tx.usageMetric.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.bankTransaction.deleteMany({ where: { userId } })
      await tx.taskCache.deleteMany({ where: { userId } })

      // Delete tags (many-to-many with clients/expenses; removing tags first clears join tables)
      await tx.tag.deleteMany({ where: { userId } })

      // Delete expenses (owns side of many-to-many with tags, already cleared)
      await tx.expense.deleteMany({ where: { userId } })

      // Clients cascade handles: linearMappings, taskOverrides, invoices (-> invoiceFiles)
      await tx.client.deleteMany({ where: { userId } })

      // User settings
      await tx.userSettings.deleteMany({ where: { userId } })

      // Deleting the user cascades to: sessions, accounts
      await tx.user.delete({ where: { id: userId } })
    })

    return NextResponse.json({
      message: "All data deleted successfully",
      retainedInvoices: retainedCount,
      retentionNote:
        retainedCount > 0
          ? `${retainedCount} invoice(s) were within the ${INVOICE_RETENTION_YEARS}-year legal retention period. They have been deleted as part of your account removal.`
          : undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
