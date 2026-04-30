import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { invoiceCreateSchema } from "@/lib/schemas/invoice"

function formatNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
}

/**
 * Reserve the next available invoice number for the given user. Tries the
 * sequence based on the current count of invoices and walks forward if there
 * are collisions (e.g. when the user previously typed a custom number that
 * happens to match the auto sequence).
 *
 * @returns a string number guaranteed to be unique for the user
 */
async function nextAutoNumber(userId: string, year: number): Promise<string> {
  const taken = new Set(
    (
      await prisma.invoice.findMany({
        where: { userId, number: { startsWith: `${year}-` } },
        select: { number: true },
      })
    ).map((r) => r.number),
  )
  const baseCount = await prisma.invoice.count({ where: { userId } })
  let seq = baseCount + 1024 + 1
  let candidate = formatNumber(year, seq)
  while (taken.has(candidate)) {
    seq += 1
    candidate = formatNumber(year, seq)
  }
  return candidate
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { issueDate: "desc" },
      include: { lines: true },
    })
    return NextResponse.json({
      items: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        clientId: inv.clientId,
        projectId: inv.projectId,
        status: inv.status,
        kind: inv.kind,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        subtotal: decimalToNumber(inv.subtotal) ?? 0,
        tax: decimalToNumber(inv.tax) ?? 0,
        total: decimalToNumber(inv.total) ?? 0,
        totalOverride: decimalToNumber(inv.totalOverride),
        notes: inv.notes,
        linesCount: inv.lines.length,
      })),
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const data = invoiceCreateSchema.parse(await req.json())

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiUnauthorized()

    const year = new Date(data.issueDate).getFullYear()
    const number =
      data.number && data.number.trim()
        ? data.number.trim()
        : await nextAutoNumber(user.id, year)

    if (data.number) {
      const conflict = await prisma.invoice.findFirst({
        where: { userId: user.id, number },
        select: { id: true },
      })
      if (conflict) {
        return NextResponse.json(
          { error: `Le numéro de facture "${number}" est déjà utilisé` },
          { status: 409 },
        )
      }
    }

    const subtotal = data.lines.reduce(
      (s, l) => s + Number(l.qty) * Number(l.rate),
      0,
    )
    const total =
      data.totalOverride != null ? Number(data.totalOverride) : subtotal

    const created = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          userId: user.id,
          clientId: data.clientId,
          projectId: data.projectId ?? null,
          number,
          status: data.status,
          kind: data.kind,
          issueDate: new Date(data.issueDate),
          dueDate: new Date(data.dueDate),
          paidAt:
            data.status === "PAID" && data.paidAt
              ? new Date(data.paidAt)
              : null,
          subtotal,
          tax: 0,
          total,
          totalOverride:
            data.totalOverride != null ? Number(data.totalOverride) : null,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((l, i) => ({
              taskId: l.taskId ?? null,
              label: l.label,
              qty: Number(l.qty),
              rate: Number(l.rate),
              position: i,
            })),
          },
        },
      })

      if (data.taskIds?.length) {
        await tx.task.updateMany({
          where: { id: { in: data.taskIds }, userId: user.id },
          data: { invoiceId: inv.id, status: "DONE" },
        })
      }

      return inv
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
