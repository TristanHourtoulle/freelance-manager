import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { invoiceStatusUpdateSchema } from "@/lib/schemas/invoice"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const inv = await prisma.invoice.findFirst({
      where: { id, userId: user.id },
      include: { lines: { orderBy: { position: "asc" } }, client: true },
    })
    if (!inv) return apiNotFound()
    return NextResponse.json({
      id: inv.id,
      number: inv.number,
      clientId: inv.clientId,
      projectId: inv.projectId,
      client: {
        id: inv.client.id,
        firstName: inv.client.firstName,
        lastName: inv.client.lastName,
        company: inv.client.company,
        email: inv.client.email,
        billingMode: inv.client.billingMode,
        color: inv.client.color,
      },
      status: inv.status,
      kind: inv.kind,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt?.toISOString() ?? null,
      subtotal: decimalToNumber(inv.subtotal) ?? 0,
      tax: decimalToNumber(inv.tax) ?? 0,
      total: decimalToNumber(inv.total) ?? 0,
      notes: inv.notes,
      lines: inv.lines.map((l) => ({
        id: l.id,
        taskId: l.taskId,
        label: l.label,
        qty: decimalToNumber(l.qty) ?? 0,
        rate: decimalToNumber(l.rate) ?? 0,
      })),
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const data = invoiceStatusUpdateSchema.parse(await req.json())
    const updated = await prisma.invoice.updateMany({
      where: { id, userId: user.id },
      data: {
        status: data.status,
        paidAt:
          data.status === "PAID"
            ? data.paidAt
              ? new Date(data.paidAt)
              : new Date()
            : null,
      },
    })
    if (updated.count === 0) return apiNotFound()
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    await prisma.$transaction([
      prisma.task.updateMany({
        where: { invoiceId: id, userId: user.id },
        data: { invoiceId: null, status: "PENDING_INVOICE" },
      }),
      prisma.invoice.deleteMany({ where: { id, userId: user.id } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
