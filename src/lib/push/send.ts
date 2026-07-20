import "server-only"
import webpush from "web-push"
import { prisma } from "@/lib/db"
import { configureWebPush } from "./vapid"

export interface PushPayload {
  title: string
  body: string
  url: string
}

function statusCodeOf(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "statusCode" in err) {
    const code = (err as { statusCode: unknown }).statusCode
    return typeof code === "number" ? code : null
  }
  return null
}

function hostOf(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return "unknown"
  }
}

/**
 * Deliver one payload to every push subscription of a user.
 *
 * Best-effort: individual failures are recorded, never thrown. A 404 or 410
 * from the push service means the subscription is permanently gone (the
 * browser was uninstalled, or iOS dropped it), so that row is deleted rather
 * than retried forever. Any other failure increments `failureCount` and logs
 * only the endpoint's host — the full endpoint is a capability URL and must
 * never reach the logs.
 *
 * @param userId - Owner of the subscriptions.
 * @param payload - Title/body/url delivered as JSON to the service worker.
 * @returns Counts of successful and pruned deliveries.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; pruned: number }> {
  if (!configureWebPush()) return { sent: 0, pruned: 0 }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  })

  const serialized = JSON.stringify(payload)
  let sent = 0
  let pruned = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        serialized,
      )
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastDeliveredAt: new Date(), failureCount: 0 },
      })
      sent += 1
    } catch (err) {
      const status = statusCodeOf(err)
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } })
        pruned += 1
        continue
      }
      console.error("[push] delivery failed", {
        endpointHost: hostOf(sub.endpoint),
        status,
      })
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastFailureAt: new Date(), failureCount: { increment: 1 } },
      })
    }
  }

  return { sent, pruned }
}
