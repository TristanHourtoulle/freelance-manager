import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { listLinearTeams } from "@/lib/linear"

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    return NextResponse.json({ items: await listLinearTeams(user.id) })
  } catch (error) {
    return apiServerError(error)
  }
}
