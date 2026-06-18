import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"
import { deferActivityLog } from "@/lib/activity"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const result = await syncFromLinear(user.id)
    revalidateTag(linearTeamsTag(user.id), "max")
    revalidateTag(linearProjectsTag(user.id), "max")
    revalidateTag(projectsTag(user.id), "max")
    revalidateTag(navTag(user.id), "max")
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
