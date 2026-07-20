import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"
import { projectUpdateSchema } from "@/lib/schemas/project"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]
 *
 * Full detail payload for one mirrored Linear project: the project row (Linear
 * mirror columns plus the app-owned workspace fields), its client, and its
 * unpaginated tasks and invoices. Every count and money total is computed
 * server-side here so the UI never derives an aggregate from a truncated list.
 */
export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const [project, tasks, invoices] = await Promise.all([
      prisma.project.findFirst({
        where: { id, userId: user.id },
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              company: true,
              color: true,
              billingMode: true,
              rate: true,
            },
          },
        },
      }),
      prisma.task.findMany({
        where: { projectId: id, userId: user.id },
        orderBy: { lastSyncedAt: "desc" },
        select: {
          id: true,
          linearIdentifier: true,
          linearUrl: true,
          title: true,
          status: true,
          estimate: true,
          invoiceId: true,
        },
      }),
      prisma.invoice.findMany({
        where: { projectId: id, userId: user.id },
        orderBy: { issueDate: "desc" },
        include: {
          _count: { select: { lines: true } },
          payments: { select: { amount: true, paidAt: true } },
        },
      }),
    ])
    if (!project) return apiNotFound()

    const invoiceRows = invoices.map((inv) => {
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
    })

    const revenue = invoiceRows.reduce((sum, inv) => sum + inv.paidAmount, 0)
    const outstanding = invoiceRows
      .filter(
        (inv) =>
          inv.status === "SENT" &&
          (inv.paymentStatus === "UNPAID" ||
            inv.paymentStatus === "PARTIALLY_PAID"),
      )
      .reduce((sum, inv) => sum + inv.balanceDue, 0)

    return NextResponse.json({
      id: project.id,
      name: project.name,
      key: project.key,
      description: project.description,
      status: project.status,
      linearProjectId: project.linearProjectId,
      linearTeamId: project.linearTeamId,
      lastSyncedAt: project.lastSyncedAt.toISOString(),
      repoUrl: project.repoUrl,
      stagingUrl: project.stagingUrl,
      prodUrl: project.prodUrl,
      runbook: project.runbook,
      client: {
        id: project.client.id,
        firstName: project.client.firstName,
        lastName: project.client.lastName,
        company: project.client.company,
        color: project.client.color,
        billingMode: project.client.billingMode,
        rate: decimalToNumber(project.client.rate) ?? 0,
      },
      tasks: tasks.map((t) => ({
        id: t.id,
        linearIdentifier: t.linearIdentifier,
        linearUrl: t.linearUrl,
        title: t.title,
        status: t.status,
        estimate: decimalToNumber(t.estimate),
        invoiceId: t.invoiceId,
      })),
      invoices: invoiceRows,
      counts: {
        tasksTotal: tasks.length,
        tasksPendingInvoice: tasks.filter((t) => t.status === "PENDING_INVOICE")
          .length,
        invoicesTotal: invoiceRows.length,
      },
      totals: { revenue, outstanding },
    })
  } catch (error) {
    return apiServerError(error)
  }
}

/**
 * PATCH /api/projects/[id]
 *
 * Updates only app-owned columns (`repoUrl`, `stagingUrl`, `prodUrl`,
 * `runbook`) plus the local `status`. Linear-mirrored columns are not
 * writable here — they belong to the sync.
 */
export async function PATCH(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const data = projectUpdateSchema.parse(await req.json())
    const owned = await prisma.project.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiNotFound()

    await prisma.project.update({
      where: { id },
      data: {
        ...("status" in data ? { status: data.status } : {}),
        ...("repoUrl" in data ? { repoUrl: data.repoUrl ?? null } : {}),
        ...("stagingUrl" in data
          ? { stagingUrl: data.stagingUrl ?? null }
          : {}),
        ...("prodUrl" in data ? { prodUrl: data.prodUrl ?? null } : {}),
        ...("runbook" in data ? { runbook: data.runbook ?? null } : {}),
      },
    })
    revalidateTag(projectsTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}

/**
 * DELETE /api/projects/[id]
 *
 * Unlinks a Linear project from the user's account: removes the local Project
 * row (which cascades to tasks) AND deletes any matching LinearMapping rows
 * referencing the same `linearProjectId` for the same client. This makes the
 * unlink stick across future syncs.
 *
 * Tasks that were already invoiced keep their invoice but lose their project
 * link (Task.projectId is NOT cascadeable from project delete because tasks
 * cascade on project delete — they go away too).
 *
 * NOTE: invoices created from those tasks are preserved. The InvoiceLine.taskId
 * is set to null because of the SetNull on Task delete.
 */
export async function DELETE(req: Request, { params }: Params) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      select: { id: true, clientId: true, linearProjectId: true },
    })
    if (!project) return apiNotFound()

    await prisma.$transaction([
      prisma.linearMapping.deleteMany({
        where: {
          clientId: project.clientId,
          linearProjectId: project.linearProjectId,
        },
      }),
      prisma.project.delete({ where: { id: project.id } }),
    ])
    revalidateTag(projectsTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiServerError(error)
  }
}
