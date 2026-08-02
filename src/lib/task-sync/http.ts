import "server-only"
import { NextResponse } from "next/server"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { prisma } from "@/lib/db"
import {
  getTaskProvider,
  UnknownTaskProviderError,
} from "@/lib/task-sync/registry"
import { triggerTaskSync } from "@/lib/task-sync/trigger"

function syncInProgress(runId: string | null) {
  return NextResponse.json(
    { error: "Sync already in progress", ...(runId ? { runId } : {}) },
    { status: 409 },
  )
}

function resolveProvider(providerId: string) {
  try {
    return getTaskProvider(providerId)
  } catch (error) {
    if (error instanceof UnknownTaskProviderError) return null
    throw error
  }
}

/** Start a background sync for any registered external task provider. */
export async function startTaskSync(req: Request, providerId: string) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf

  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  const provider = resolveProvider(providerId)
  if (!provider) return apiNotFound()

  const result = await triggerTaskSync(provider, user.id)
  if (result.status === "in_progress") return syncInProgress(result.runId)
  return NextResponse.json(
    {
      status: "started",
      runId: result.runId,
      totalMappings: result.totalMappings,
    },
    { status: 202 },
  )
}

/** Return the latest run for the authenticated user and requested provider. */
export async function getTaskSyncStatus(providerId: string) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  const provider = resolveProvider(providerId)
  if (!provider) return apiNotFound()

  try {
    const run = await prisma.taskSyncRun.findFirst({
      where: { userId: user.id, providerId: provider.id },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        status: true,
        totalMappings: true,
        doneMappings: true,
        currentLabel: true,
        projectsUpserted: true,
        tasksUpserted: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
      },
    })

    if (!run) return NextResponse.json({ status: "idle" })

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      totalMappings: run.totalMappings,
      doneMappings: run.doneMappings,
      currentLabel: run.currentLabel,
      projectsUpserted: run.projectsUpserted,
      tasksUpserted: run.tasksUpserted,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })
  } catch (error) {
    return apiServerError(error)
  }
}
