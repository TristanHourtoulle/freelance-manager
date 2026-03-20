import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { NextResponse } from "next/server"

/**
 * GET /api/billing/export
 * Exports all user invoices as a CSV file.
 *
 * @returns 200 - CSV file download
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    const invoices = await prisma.invoice.findMany({
      where: { client: { userId } },
      orderBy: { month: "desc" },
      include: { client: { select: { name: true } } },
    })

    const header = "Month,Client,Amount,Status,Payment Due Date,Created At"
    const rows = invoices.map((i) =>
      [
        i.month.toISOString().split("T")[0],
        `"${i.client.name.replace(/"/g, '""')}"`,
        Number(i.totalAmount).toFixed(2),
        i.status,
        i.paymentDueDate ? i.paymentDueDate.toISOString().split("T")[0] : "",
        i.createdAt.toISOString().split("T")[0],
      ].join(","),
    )
    const csv = [header, ...rows].join("\n")

    logAudit({
      userId,
      action: AUDIT_ACTIONS.EXPORT,
      entity: "Invoice",
      metadata: { format: "csv", count: invoices.length },
    })

    const dateLabel = new Date().toISOString().split("T")[0]

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="invoices-${dateLabel}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
