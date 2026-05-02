import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { clientUpdateSchema } from "@/lib/schemas/client"
import { getInvoiceComputed } from "@/lib/payments"
import { logActivity } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const c = await prisma.client.findFirst({
      where: { id, userId: user.id },
      include: {
        projects: { orderBy: { createdAt: "desc" } },
        linearMappings: true,
      },
    })
    if (!c) return apiNotFound()

    const [tasks, invoices] = await Promise.all([
      prisma.task.findMany({
        where: { clientId: c.id },
        orderBy: { lastSyncedAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { clientId: c.id },
        orderBy: { issueDate: "desc" },
        include: {
          _count: { select: { lines: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
    ])

    const today = new Date()
    const monthlyRevenue: { month: string; total: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const end = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
      const total = invoices
        .flatMap((inv) => inv.payments)
        .filter((p) => p.paidAt >= start && p.paidAt < end)
        .reduce((s, p) => s + (decimalToNumber(p.amount) ?? 0), 0)
      monthlyRevenue.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total,
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

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
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
      await logActivity(tx, {
        userId: user.id,
        kind: "CLIENT_UPDATED",
        title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} mis à jour`,
        clientId: id,
      })
    })
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
    const owned = await prisma.client.findFirst({
      where: { id, userId: user.id },
      select: { id: true, firstName: true, lastName: true, company: true },
    })
    if (!owned) return apiNotFound()

    await prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id },
        data: { archivedAt: new Date() },
      })
      await logActivity(tx, {
        userId: user.id,
        kind: "CLIENT_ARCHIVED",
        title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} archivé`,
        clientId: id,
      })
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
