import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * Counts shown as badges next to sidebar items:
 * - clients: active (non-archived) clients
 * - projects: active projects
 * - tasks: tasks in PENDING_INVOICE state (the "ready to bill" backlog)
 * - invoices: invoices in DRAFT, SENT or OVERDUE (i.e. not yet PAID)
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id

  const [clients, projects, tasks, invoices] = await Promise.all([
    prisma.client.count({ where: { userId, archivedAt: null } }),
    prisma.project.count({ where: { userId, status: "ACTIVE" } }),
    prisma.task.count({ where: { userId, status: "PENDING_INVOICE" } }),
    prisma.invoice.count({
      where: {
        userId,
        status: { in: ["DRAFT", "SENT", "OVERDUE"] },
      },
    }),
  ])

  return NextResponse.json({ clients, projects, tasks, invoices })
}
