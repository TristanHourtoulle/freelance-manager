import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { getLinearTeams } from "@/lib/data/linear"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    return NextResponse.json({ items: await getLinearTeams(user.id) })
  } catch (error) {
    return apiServerError(error)
  }
}
