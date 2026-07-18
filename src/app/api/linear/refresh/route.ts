import { NextResponse, after } from "next/server"
import { revalidateTag } from "next/cache"
import { apiUnauthorized, getAuthUser, requireSameOrigin } from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"
import { deferActivityLog } from "@/lib/activity"
import { linearProjectsTag, linearTeamsTag } from "@/lib/data/linear"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"

/**
 * Trigger a Linear sync for the current user.
 *
 * The pull+write runs off the request thread via `after()`, so the client
 * receives an immediate 202. Cache revalidation and the activity log fire
 * only once the background sync has actually completed; a failure there is
 * logged and never surfaces to the (already-sent) response.
 *
 * @returns 202 `{ status: "started" }`, or 401 when unauthenticated.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  after(async () => {
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
    } catch (error) {
      console.error("[linear/refresh] background sync failed", error)
    }
  })

  return NextResponse.json({ status: "started" }, { status: 202 })
}
