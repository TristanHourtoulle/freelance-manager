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
  clients: Array<Record<string, unknown>>,
  columns: string[],
): string {
  const header = columns.join(",")
  const rows = clients.map((c) =>
    columns.map((col) => escapeCsvField(String(c[col] ?? ""))).join(","),
  )
  return [header, ...rows].join("\n")
}

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const format = url.searchParams.get("format") ?? "csv"

    const clients = await prisma.client.findMany({
      where: { userId: userOrError.id },
      orderBy: { createdAt: "desc" },
    })

    const data = clients.map((c) => ({
      name: c.name,
      email: c.email ?? "",
      company: c.company ?? "",
      billingMode: c.billingMode,
      rate: Number(c.rate),
      category: c.category,
      notes: c.notes ?? "",
      archived: c.archivedAt ? "yes" : "no",
      createdAt: c.createdAt.toISOString(),
    }))

    if (format === "json") {
      return new NextResponse(JSON.stringify(data, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      })
    }

    const columns = [
      "name",
      "email",
      "company",
      "billingMode",
      "rate",
      "category",
      "notes",
      "archived",
      "createdAt",
    ]
    const csv = toCsv(data, columns)

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
