import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { updateSettingsSchema } from "@/lib/schemas/settings"
import { NextResponse } from "next/server"

/**
 * GET /api/settings
 * Retrieves user settings (creates defaults if none exist).
 * @returns 200 - `{ availableHoursPerMonth, monthlyRevenueTarget }`
 * @throws 401 - Unauthenticated request
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const settings = await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: { userId: userOrError.id },
      update: {},
    })

    return NextResponse.json({
      availableHoursPerMonth: settings.availableHoursPerMonth,
      monthlyRevenueTarget: Number(settings.monthlyRevenueTarget),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/settings
 * Updates user settings (available hours per month, monthly revenue target).
 * @returns 200 - `{ availableHoursPerMonth, monthlyRevenueTarget }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Invalid request body
 */
export async function PUT(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body: unknown = await request.json()
    const parsed = updateSettingsSchema.parse(body)

    const updateData: Record<string, unknown> = {}
    if (parsed.availableHoursPerMonth !== undefined) {
      updateData.availableHoursPerMonth = parsed.availableHoursPerMonth
    }
    if (parsed.monthlyRevenueTarget !== undefined) {
      updateData.monthlyRevenueTarget = parsed.monthlyRevenueTarget
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: {
        userId: userOrError.id,
        ...updateData,
      },
      update: updateData,
    })

    return NextResponse.json({
      availableHoursPerMonth: settings.availableHoursPerMonth,
      monthlyRevenueTarget: Number(settings.monthlyRevenueTarget),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
