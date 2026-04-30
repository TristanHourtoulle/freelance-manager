import { NextResponse } from "next/server"
import { apiServerError, apiUnauthorized, getAuthUser } from "@/lib/api"
import { listLinearProjects } from "@/lib/linear"

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const url = new URL(req.url)
    const teamId = url.searchParams.get("teamId") ?? undefined
    return NextResponse.json({
      items: await listLinearProjects(user.id, teamId),
    })
  } catch (error) {
    return apiServerError(error)
  }
}
