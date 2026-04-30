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
        include: { lines: true },
      }),
    ])

    return NextResponse.json({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      company: c.company,
      email: c.email,
      phone: c.phone,
      billingMode: c.billingMode,
      rate: decimalToNumber(c.rate) ?? 0,
      fixedPrice: decimalToNumber(c.fixedPrice),
      deposit: decimalToNumber(c.deposit),
      paymentTerms: c.paymentTerms,
      category: c.category,
      color: c.color,
      archived: c.archivedAt != null,
      createdAt: c.createdAt.toISOString(),
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
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        kind: inv.kind,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        total: decimalToNumber(inv.total) ?? 0,
        linesCount: inv.lines.length,
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
    const data = clientUpdateSchema.parse(await req.json())
    await prisma.client.updateMany({
      where: { id, userId: user.id },
      data: {
        ...("firstName" in data ? { firstName: data.firstName } : {}),
        ...("lastName" in data ? { lastName: data.lastName } : {}),
        ...("company" in data ? { company: data.company ?? null } : {}),
        ...("email" in data ? { email: data.email ?? null } : {}),
        ...("phone" in data ? { phone: data.phone ?? null } : {}),
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
      },
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
    await prisma.client.deleteMany({ where: { id, userId: user.id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
