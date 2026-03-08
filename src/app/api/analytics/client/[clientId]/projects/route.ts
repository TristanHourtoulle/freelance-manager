import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import {
  computeDateRange,
  fetchIssueMapForClient,
  computeGroupAmount,
} from "@/lib/analytics-helpers"
import { fetchLinearProjects } from "@/lib/linear-service"
import { NextResponse } from "next/server"

import type { OverrideWithClient } from "@/lib/analytics-helpers"
import type { BillingMode } from "@/generated/prisma/client"

interface RouteContext {
  params: Promise<{ clientId: string }>
}

/**
 * GET /api/analytics/client/:clientId/projects
 * Returns per-project revenue and hours breakdown for a specific client.
 * @returns 200 - `{ clientId, clientName, projects: { projectId, projectName, hours, amount }[] }`
 * @throws 401 - Unauthenticated request
 * @throws 404 - Client not found
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { clientId } = await context.params
    const url = new URL(request.url)
    const period = url.searchParams.get("period") ?? "3m"
    const fromParam = url.searchParams.get("from")
    const toParam = url.searchParams.get("to")

    const { from, to } = computeDateRange(period, fromParam, toParam)

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId: userOrError.id, archivedAt: null },
      include: { linearMappings: true },
    })

    if (!client) {
      return apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    }

    const overrides = await prisma.taskOverride.findMany({
      where: {
        clientId,
        invoiced: true,
        invoicedAt: { not: null, gte: from, lte: to },
      },
      include: {
        client: { include: { linearMappings: true } },
      },
    })

    const billingMode = client.billingMode as BillingMode

    // FIXED billing: return single aggregate (no per-project split)
    if (billingMode === "FIXED") {
      const rate = Number(client.rate)
      const totalAmount = overrides.length > 0 ? rate : 0

      return NextResponse.json({
        clientId,
        clientName: client.name,
        projects: [
          {
            projectId: "fixed",
            projectName: "Fixed rate",
            hours: 0,
            amount: Math.round(totalAmount * 100) / 100,
          },
        ],
      })
    }

    const issueMap = await fetchIssueMapForClient(client)

    // Group overrides by projectId
    const byProject = new Map<string, OverrideWithClient[]>()
    for (const override of overrides) {
      const issue = issueMap.get(override.linearIssueId)
      const projectId = issue?.projectId ?? "unassigned"

      const list = byProject.get(projectId) ?? []
      list.push(override)
      byProject.set(projectId, list)
    }

    // Resolve project names
    const allProjects = await fetchLinearProjects()
    const projectNameMap = new Map(allProjects.map((p) => [p.id, p.name]))

    // Compute hours + amount per project
    const projects: Array<{
      projectId: string
      projectName: string
      hours: number
      amount: number
    }> = []

    for (const [projectId, projectOverrides] of byProject) {
      const { amount, hours } = computeGroupAmount(
        projectOverrides,
        issueMap,
        client,
      )

      projects.push({
        projectId,
        projectName:
          projectId === "unassigned"
            ? "No project"
            : (projectNameMap.get(projectId) ?? "Unknown project"),
        hours,
        amount: Math.round(amount * 100) / 100,
      })
    }

    projects.sort((a, b) => b.hours - a.hours)

    return NextResponse.json({
      clientId,
      clientName: client.name,
      projects,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes("LINEAR_API_TOKEN")) {
      return apiError(
        "LINEAR_NOT_CONFIGURED",
        "Linear API token is not configured",
        503,
      )
    }
    return handleApiError(error)
  }
}
