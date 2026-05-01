import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            color: true,
          },
        },
        _count: { select: { tasks: true } },
      },
    })
    return NextResponse.json({
      items: projects.map((p) => ({
        id: p.id,
        clientId: p.clientId,
        client: p.client,
        linearProjectId: p.linearProjectId,
        linearTeamId: p.linearTeamId,
        name: p.name,
        key: p.key,
        description: p.description,
        status: p.status,
        tasksTotal: p._count.tasks,
      })),
    })
  } catch (error) {
    return apiServerError(error)
  }
}
