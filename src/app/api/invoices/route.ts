import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { invoiceCreateSchema } from "@/lib/schemas/invoice"

function makeInvoiceNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
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

    // Check the client is owned by this user
    const client = await prisma.client.findFirst({
      where: { id: data.clientId, userId: user.id },
      select: { id: true },
    })
    if (!client) return apiUnauthorized()

    const year = new Date(data.issueDate).getFullYear()
    const seq =
      (await prisma.invoice.count({ where: { userId: user.id } })) + 1024 + 1
    const number = makeInvoiceNumber(year, seq)

    const subtotal = data.lines.reduce(
      (s, l) => s + Number(l.qty) * Number(l.rate),
      0,
    )

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
          subtotal,
          tax: 0,
          total: subtotal,
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
