import { NextResponse } from "next/server"
import { updateTag } from "next/cache"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"
import { deferActivityLog } from "@/lib/activity"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const result = await syncFromLinear(user.id)
    updateTag(linearTeamsTag(user.id))
    updateTag(linearProjectsTag(user.id))
    deferActivityLog({
      userId: user.id,
      kind: "LINEAR_SYNCED",
      title: `Sync Linear · ${result.tasks} tasks · ${result.projects} projets`,
    })
    return NextResponse.json(result)
  } catch (error) {
    return apiServerError(error)
  }
}
