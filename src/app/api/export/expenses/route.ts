import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsv(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): string {
  const header = columns.join(",")
  const body = rows.map((r) =>
    columns.map((col) => escapeCsvField(String(r[col] ?? ""))).join(","),
  )
  return [header, ...body].join("\n")
}

/**
 * GET /api/export/expenses
 * Exports the authenticated user's expenses as CSV or JSON.
 * Query params: `?format=csv|json`
 * @returns 200 - CSV or JSON file download
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const format = url.searchParams.get("format") ?? "csv"

    const expenses = await prisma.expense.findMany({
      where: { userId: userOrError.id },
      include: { client: { select: { name: true } } },
      orderBy: { date: "desc" },
    })

    const data = expenses.map((e) => ({
      description: e.description,
      amount: Number(e.amount),
      date: e.date.toISOString().slice(0, 10),
      category: e.category,
      clientName: e.client?.name ?? "",
      recurring: e.recurring ? "true" : "false",
      createdAt: e.createdAt.toISOString(),
    }))

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    const columns = [
      "description",
      "amount",
      "date",
      "category",
      "clientName",
      "recurring",
      "createdAt",
    ]
    const csv = toCsv(data, columns)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
