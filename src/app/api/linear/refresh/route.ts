import { NextResponse } from "next/server"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { syncFromLinear } from "@/lib/linear"
import { deferActivityLog } from "@/lib/activity"

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  try {
    const result = await syncFromLinear(user.id)
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
