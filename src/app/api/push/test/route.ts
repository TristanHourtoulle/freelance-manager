import { NextResponse } from "next/server"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { sendPushToUser } from "@/lib/push/send"

/**
 * POST /api/push/test
 *
 * Sends ONE test notification to every subscription of the session user. This
 * is the only way the owner can tell a live subscription from one a phone
 * silently dropped, so it stays manual and explicit.
 *
 * @param req - The request, used for the same-origin check.
 * @returns 200 with `{ sent, pruned }`, 401 anonymous, 403 cross-origin.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const result = await sendPushToUser(user.id, {
      title: "Test",
      body: "Les notifications fonctionnent.",
      url: "/dashboard",
    })
    return NextResponse.json(result)
  } catch (error) {
    return apiServerError(error)
  }
}
