import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { isPushConfigured } from "@/lib/push/vapid"
import { pushSubscribeSchema, pushUnsubscribeSchema } from "@/lib/schemas/push"

/**
 * GET /api/push/subscribe
 *
 * Reports whether the deployment has VAPID keys and whether the caller has at
 * least one live subscription, plus the last successful delivery — the only
 * way the owner can tell a live subscription from one a phone silently
 * dropped.
 *
 * @returns 200 with `{ configured, subscribed, lastDeliveredAt }`, 401 anonymous.
 */
export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const latest = await prisma.pushSubscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { lastDeliveredAt: true },
    })

    return NextResponse.json({
      configured: isPushConfigured(),
      subscribed: Boolean(latest),
      lastDeliveredAt: latest?.lastDeliveredAt?.toISOString() ?? null,
    })
  } catch (error) {
    return apiServerError(error)
  }
}

/**
 * POST /api/push/subscribe
 *
 * Stores a browser push subscription for the session user. Upserts on the
 * UNIQUE `endpoint` so re-subscribing the same browser never accumulates
 * duplicates, and always rewrites `userId` so an endpoint follows its owner.
 *
 * @param req - Request carrying the serialized PushSubscription.
 * @returns 201 with `{ ok: true }`, 401 anonymous, 403 cross-origin.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const data = pushSubscribeSchema.parse(await req.json())
    const userAgent = req.headers.get("user-agent")

    await prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      create: {
        userId: user.id,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
      },
      update: {
        userId: user.id,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent,
        failureCount: 0,
        lastFailureAt: null,
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}

/**
 * DELETE /api/push/subscribe
 *
 * Removes one of the session user's subscriptions. Scoped by `userId` as well
 * as `endpoint` so a known endpoint can never be used to delete another
 * account's row.
 *
 * @param req - Request carrying `{ endpoint }`.
 * @returns 200 with `{ deleted }`, 401 anonymous, 403 cross-origin.
 */
export async function DELETE(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const data = pushUnsubscribeSchema.parse(await req.json())
    const result = await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint: data.endpoint },
    })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    return apiServerError(error)
  }
}
