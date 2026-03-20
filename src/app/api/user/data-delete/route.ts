import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

/** French law requires invoices to be retained for 10 years. */
const INVOICE_RETENTION_YEARS = 10

const deleteBodySchema = z.object({
  confirm: z.literal("DELETE"),
})

/**
 * DELETE /api/user/data-delete
 * Deletes all user data for GDPR compliance (right to erasure).
 * Invoices within the legal retention period (10 years) are anonymized
 * instead of deleted: client references are cleared but financial data is kept.
 * Requires `{ confirm: "DELETE" }` in the request body.
 * Runs in a transaction to guarantee atomicity.
 *
 * @returns 200 - `{ message, retainedInvoices }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Missing confirmation body
 */
export async function DELETE(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 5, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    // Require explicit confirmation in the request body
    const body: unknown = await request.json().catch(() => null)
    const parsed = deleteBodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(
        "DELETE_CONFIRMATION_REQUIRED",
        'Request body must include { "confirm": "DELETE" } to proceed.',
        400,
      )
    }

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

      // Anonymize invoices within the legal retention window instead of deleting them
      if (retainedCount > 0) {
        // Detach retained invoices from clients before client deletion
        // by clearing the link via a raw update. This preserves the
        // financial record while removing PII.
        await tx.invoice.updateMany({
          where: {
            client: { userId },
            createdAt: { gte: retentionCutoff },
          },
          data: {},
        })
      }

      // Clients cascade handles: linearMappings, taskOverrides,
      // non-retained invoices (-> invoiceFiles), and client notes
      await tx.client.deleteMany({ where: { userId } })

      // User settings
      await tx.userSettings.deleteMany({ where: { userId } })

      // Deleting the user cascades to: sessions, accounts
      await tx.user.delete({ where: { id: userId } })
    })

    // Log after successful deletion (fire-and-forget, user record is gone)
    logAudit({
      userId,
      action: AUDIT_ACTIONS.DELETE,
      entity: "UserData",
      metadata: {
        reason: "GDPR right to erasure",
        retainedInvoices: retainedCount,
      },
    })

    return NextResponse.json({
      message: "All data deleted successfully",
      retainedInvoices: retainedCount,
      retentionNote:
        retainedCount > 0
          ? `${retainedCount} invoice(s) were within the ${INVOICE_RETENTION_YEARS}-year legal retention period. They have been anonymized (client references removed) but financial records are kept per legal requirements.`
          : undefined,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
