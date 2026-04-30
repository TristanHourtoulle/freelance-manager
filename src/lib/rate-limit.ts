/**
 * In-memory rate limiter using a sliding window approach.
 * Suitable for single-instance deployments (no Redis required).
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

const DEFAULT_LIMIT = 100
const DEFAULT_WINDOW_MS = 60_000

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window. */
  limit?: number
  /** Window duration in milliseconds. */
  windowMs?: number
}

interface RateLimitResult {
  /** Whether the request is allowed. */
  success: boolean
  /** Number of remaining requests in the current window. */
  remaining: number
  /** Time in milliseconds until the window resets. */
  reset: number
}

/**
 * Extracts a client identifier from the request headers.
 * Falls back to a static key when no forwarding headers are present.
 */
function getClientKey(request: Request): string {
  const realIp = request.headers.get("x-real-ip")
  if (realIp) {
    return realIp.trim()
  }

  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]
    return first ? first.trim() : "unknown"
  }

  return "unknown"
}

/** Removes expired entries from the store. */
function cleanup(): void {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key)
    }
  }
}

if (typeof globalThis !== "undefined") {
  const intervalKey = "__rateLimitCleanupInterval" as const
  const g = globalThis as unknown as Record<
    string,
    ReturnType<typeof setInterval> | undefined
  >
  if (!g[intervalKey]) {
    g[intervalKey] = setInterval(cleanup, 60_000)
    if (
      typeof g[intervalKey] === "object" &&
      "unref" in (g[intervalKey] as object)
    ) {
      ;(g[intervalKey] as NodeJS.Timeout).unref()
    }
  }
}

/**
 * Checks whether the request is within rate limits.
 *
 * @param request - Incoming HTTP request
 * @param options - Optional limit and window configuration
 * @returns Rate limit result with success flag, remaining count, and reset time
 */
export function rateLimit(
  request: Request,
  options?: RateLimitOptions,
): RateLimitResult {
  const limit = options?.limit ?? DEFAULT_LIMIT
  const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS
  const key = getClientKey(request)
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1, reset: windowMs }
  }

  entry.count += 1
  const remaining = Math.max(0, limit - entry.count)
  const reset = entry.resetAt - now

  if (entry.count > limit) {
    return { success: false, remaining: 0, reset }
  }

  return { success: true, remaining, reset }
}

/** @internal Exported for testing only – removes expired entries from the store. */
export { cleanup as _cleanup }

export type { RateLimitOptions, RateLimitResult }
