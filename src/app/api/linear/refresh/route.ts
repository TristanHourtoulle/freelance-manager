import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { clearLinearCaches, getLinearSyncStatus } from "@/lib/linear-service"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    clearLinearCaches()

    return NextResponse.json({
      clearedAt: Date.now(),
      ...getLinearSyncStatus(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
