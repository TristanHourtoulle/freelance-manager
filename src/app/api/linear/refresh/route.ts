import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"

export async function POST() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const result = await syncFromLinear(user.id)
    return NextResponse.json(result)
  } catch (error) {
    return apiServerError(error)
  }
}
