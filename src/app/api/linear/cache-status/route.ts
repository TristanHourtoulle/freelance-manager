import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { getLinearSyncStatus } from "@/lib/linear-service"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    return NextResponse.json(getLinearSyncStatus())
  } catch (error) {
    return handleApiError(error)
  }
}
