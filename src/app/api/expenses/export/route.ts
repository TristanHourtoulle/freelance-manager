import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { NextResponse } from "next/server"

/**
 * GET /api/expenses/export
 * Exports all user expenses as a CSV file.
 *
 * @returns 200 - CSV file download
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    const expenses = await prisma.expense.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { client: { select: { name: true } } },
    })

    const header =
      "Date,Description,Category,Amount,Client,Recurring,Receipt URL"
    const rows = expenses.map((e) =>
      [
        e.date.toISOString().split("T")[0],
        `"${e.description.replace(/"/g, '""')}"`,
        e.category,
        Number(e.amount).toFixed(2),
        `"${e.client?.name ?? ""}"`,
        e.recurring ? "Yes" : "No",
        e.receiptUrl ?? "",
      ].join(","),
    )
    const csv = [header, ...rows].join("\n")

    logAudit({
      userId,
      action: AUDIT_ACTIONS.EXPORT,
      entity: "Expense",
      metadata: { format: "csv", count: expenses.length },
    })

    const dateLabel = new Date().toISOString().split("T")[0]

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${dateLabel}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
