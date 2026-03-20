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

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const format = url.searchParams.get("format") ?? "csv"

    const invoices = await prisma.invoice.findMany({
      where: { client: { userId: userOrError.id } },
      include: { client: { select: { name: true, company: true } } },
      orderBy: { month: "desc" },
    })

    const data = invoices.map((inv) => ({
      client: inv.client.company
        ? `${inv.client.name} (${inv.client.company})`
        : inv.client.name,
      month: inv.month.toISOString().slice(0, 7),
      totalAmount: Number(inv.totalAmount),
      status: inv.status,
      paymentDueDate: inv.paymentDueDate?.toISOString().slice(0, 10) ?? "",
      createdAt: inv.createdAt.toISOString(),
    }))

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    const columns = [
      "client",
      "month",
      "totalAmount",
      "status",
      "paymentDueDate",
      "createdAt",
    ]
    const csv = toCsv(data, columns)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
