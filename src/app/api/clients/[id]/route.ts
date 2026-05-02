import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { clientUpdateSchema } from "@/lib/schemas/client"
import { getInvoiceComputed } from "@/lib/payments"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const today = new Date()
    const monthlyStart = new Date(today.getFullYear(), today.getMonth() - 11, 1)

    const [c, tasks, invoices, monthlyTotals] = await Promise.all([
      prisma.client.findFirst({
        where: { id, userId: user.id },
        include: {
          projects: { orderBy: { createdAt: "desc" } },
          linearMappings: true,
        },
      }),
      prisma.task.findMany({
        where: { clientId: id, userId: user.id },
        orderBy: { lastSyncedAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { clientId: id, userId: user.id },
        orderBy: { issueDate: "desc" },
        include: {
          _count: { select: { lines: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
      prisma.$queryRaw<{ month: Date; total: number }[]>`
        SELECT date_trunc('month', p."paidAt") AS month,
               SUM(p.amount)::float AS total
        FROM payments p
        JOIN invoices i ON p."invoiceId" = i.id
        WHERE i."clientId" = ${id}
          AND i."userId" = ${user.id}
          AND p."paidAt" >= ${monthlyStart}
        GROUP BY 1
        ORDER BY 1
      `,
    ])
    if (!c) return apiNotFound()

    const monthlyMap = new Map(
      monthlyTotals.map((b) => [b.month.toISOString().slice(0, 7), b.total]),
    )
    const monthlyRevenue: { month: string; total: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const key = start.toISOString().slice(0, 7)
      monthlyRevenue.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total: monthlyMap.get(key) ?? 0,
      })
    }

    return NextResponse.json({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      email: c.email,
      phone: c.phone,
      website: c.website,
      address: c.address,
      notes: c.notes,
      billingMode: c.billingMode,
      rate: decimalToNumber(c.rate) ?? 0,
      fixedPrice: decimalToNumber(c.fixedPrice),
      deposit: decimalToNumber(c.deposit),
      paymentTerms: c.paymentTerms,
      category: c.category,
      color: c.color,
      starred: c.starred,
      archived: c.archivedAt != null,
      createdAt: c.createdAt.toISOString(),
      monthlyRevenue,
      projects: c.projects.map((p) => ({
        id: p.id,
        name: p.name,
        key: p.key,
        description: p.description,
        status: p.status,
        linearProjectId: p.linearProjectId,
      })),
      linearMappings: c.linearMappings.map((m) => ({
        id: m.id,
        linearTeamId: m.linearTeamId,
        linearProjectId: m.linearProjectId,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        linearIdentifier: t.linearIdentifier,
        title: t.title,
        status: t.status,
        estimate: decimalToNumber(t.estimate),
        projectId: t.projectId,
        invoiceId: t.invoiceId,
      })),
      invoices: invoices.map((inv) => {
        const computed = getInvoiceComputed(inv)
        return {
          id: inv.id,
          number: inv.number,
          status: inv.status,
          paymentStatus: inv.paymentStatus,
          isOverdue: computed.isOverdue,
          kind: inv.kind,
          issueDate: inv.issueDate.toISOString(),
          dueDate: inv.dueDate.toISOString(),
          paidAmount: computed.paidAmount,
          balanceDue: computed.balanceDue,
          total: decimalToNumber(inv.total) ?? 0,
          linesCount: inv._count.lines,
        }
      }),
    })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const data = clientUpdateSchema.parse(await req.json())
    const owned = await prisma.client.findFirst({
      where: { id, userId: user.id },
      select: { id: true, firstName: true, lastName: true, company: true },
    })
    if (!owned) return apiNotFound()

    await prisma.client.update({
      where: { id },
      data: {
        ...("firstName" in data ? { firstName: data.firstName } : {}),
        ...("lastName" in data ? { lastName: data.lastName } : {}),
        ...("company" in data ? { company: data.company ?? null } : {}),
        ...("email" in data ? { email: data.email ?? null } : {}),
        ...("phone" in data ? { phone: data.phone ?? null } : {}),
        ...("website" in data ? { website: data.website ?? null } : {}),
        ...("address" in data ? { address: data.address ?? null } : {}),
        ...("notes" in data ? { notes: data.notes ?? null } : {}),
        ...("billingMode" in data ? { billingMode: data.billingMode } : {}),
        ...("rate" in data ? { rate: data.rate } : {}),
        ...("fixedPrice" in data
          ? { fixedPrice: data.fixedPrice ?? null }
          : {}),
        ...("deposit" in data ? { deposit: data.deposit ?? null } : {}),
        ...("paymentTerms" in data
          ? { paymentTerms: data.paymentTerms ?? null }
          : {}),
        ...("category" in data ? { category: data.category } : {}),
        ...("color" in data ? { color: data.color ?? null } : {}),
        ...("starred" in data ? { starred: data.starred } : {}),
      },
    })
    deferActivityLog({
      userId: user.id,
      kind: "CLIENT_UPDATED",
      title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} mis à jour`,
      clientId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params
  try {
    const owned = await prisma.client.findFirst({
      where: { id, userId: user.id },
      select: { id: true, firstName: true, lastName: true, company: true },
    })
    if (!owned) return apiNotFound()

    await prisma.client.update({
      where: { id },
      data: { archivedAt: new Date() },
    })
    deferActivityLog({
      userId: user.id,
      kind: "CLIENT_ARCHIVED",
      title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} archivé`,
      clientId: id,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
