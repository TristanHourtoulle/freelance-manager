import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { updateSettingsSchema } from "@/lib/schemas/settings"
import { NextResponse } from "next/server"

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
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body: unknown = await request.json()
    const parsed = updateSettingsSchema.parse(body)

    const settings = await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: {
        userId: userOrError.id,
        availableHoursPerMonth: parsed.availableHoursPerMonth,
      },
      update: {
        availableHoursPerMonth: parsed.availableHoursPerMonth,
      },
    })

    return NextResponse.json({
      availableHoursPerMonth: settings.availableHoursPerMonth,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
