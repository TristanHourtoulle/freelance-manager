import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const url = new URL(req.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const projectId = url.searchParams.get("projectId") ?? undefined
    const status = url.searchParams.get("status") ?? undefined

    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(status
          ? {
              status: status as
                | "PENDING_INVOICE"
                | "DONE"
                | "IN_PROGRESS"
                | "BACKLOG"
                | "CANCELED",
            }
          : {
              status: {
                in: ["PENDING_INVOICE", "DONE", "IN_PROGRESS", "BACKLOG"],
              },
            }),
      },
      orderBy: [{ projectId: "asc" }, { linearIdentifier: "asc" }],
      select: {
        id: true,
        linearIssueId: true,
        linearIdentifier: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        completedAt: true,
        invoiceId: true,
        clientId: true,
        projectId: true,
      },
    })

    return NextResponse.json({
      items: tasks.map((t) => ({
        id: t.id,
        linearIssueId: t.linearIssueId,
        linearIdentifier: t.linearIdentifier,
        title: t.title,
        status: t.status,
        priority: t.priority,
        estimate: decimalToNumber(t.estimate),
        completedAt: t.completedAt?.toISOString() ?? null,
        invoiceId: t.invoiceId,
        clientId: t.clientId,
        projectId: t.projectId,
      })),
    })
  } catch (error) {
    return apiServerError(error)
  }
}
