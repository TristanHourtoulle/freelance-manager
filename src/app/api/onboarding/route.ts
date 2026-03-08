import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

/**
 * GET /api/onboarding
 * Returns onboarding progress: which setup steps are completed and overall completion count.
 * @returns 200 - `{ steps, completedCount, totalSteps, allCompleted }`
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    const [clientCount, mappingCount, taskCount, invoicedCount, settings] =
      await Promise.all([
        prisma.client.count({ where: { userId, archivedAt: null } }),
        prisma.linearMapping.count({ where: { client: { userId } } }),
        prisma.taskOverride.count({ where: { client: { userId } } }),
        prisma.taskOverride.count({
          where: { invoiced: true, client: { userId } },
        }),
        prisma.userSettings.findUnique({
          where: { userId },
          select: {
            availableHoursPerMonth: true,
            monthlyRevenueTarget: true,
          },
        }),
      ])

    const steps = {
      hasClient: clientCount > 0,
      hasBillingDefaults:
        Number(settings?.monthlyRevenueTarget ?? 0) > 0 ||
        (settings?.availableHoursPerMonth ?? 140) !== 140,
      hasLinearMapping: mappingCount > 0,
      hasTaskImported: taskCount > 0,
      hasInvoiced: invoicedCount > 0,
    }

    const completedCount = Object.values(steps).filter(Boolean).length
    const totalSteps = 5

    return NextResponse.json({
      steps,
      completedCount,
      totalSteps,
      allCompleted: completedCount === totalSteps,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
