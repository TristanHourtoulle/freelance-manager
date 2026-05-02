import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"
import { prisma } from "@/lib/db"
import { logActivity } from "@/lib/activity"

export async function POST() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const result = await syncFromLinear(user.id)
    await prisma.$transaction(async (tx) => {
      await logActivity(tx, {
        userId: user.id,
        kind: "LINEAR_SYNCED",
        title: `Sync Linear · ${result.tasks} tasks · ${result.projects} projets`,
      })
    })
    return NextResponse.json(result)
  } catch (error) {
    return apiServerError(error)
  }
}
