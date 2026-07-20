import { timingSafeEqual } from "crypto"

export type CronAuthResult =
  | { ok: true }
  | {
      ok: false
      status: 401 | 503
      code: "CRON_NOT_CONFIGURED" | "CRON_BAD_KEY"
    }

/**
 * Authorize a scheduler request against CRON_SECRET.
 *
 * Fails CLOSED: when CRON_SECRET is unset the endpoint is unusable rather
 * than open, so a misconfigured deployment can never expose an
 * unauthenticated write path. The key is read from the X-Cron-Key header,
 * compared in constant time, and is never logged nor echoed back.
 *
 * @param request - The incoming scheduler request.
 * @returns `{ ok: true }` when authorized, otherwise the status to return.
 */
export function authorizeCronRequest(request: Request): CronAuthResult {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return { ok: false, status: 503, code: "CRON_NOT_CONFIGURED" }
  }

  const provided = request.headers.get("x-cron-key")
  if (!provided || !constantTimeEquals(expected, provided)) {
    return { ok: false, status: 401, code: "CRON_BAD_KEY" }
  }

  return { ok: true }
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
