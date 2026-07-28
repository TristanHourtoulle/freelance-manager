const DEFAULT_LIMIT = 60
const DEFAULT_WINDOW_MS = 60_000
const SWEEP_THRESHOLD = 1_000

export interface McpRateLimiterOptions {
  limit?: number
  windowMs?: number
}

export interface McpRateDecision {
  allowed: boolean
  retryAfterMs: number
}

interface WindowState {
  windowStart: number
  count: number
}

/**
 * In-process fixed-window rate limiter keyed by principal.
 *
 * LIMITATION — single-process only: state lives in this module's memory,
 * which is correct for the app's current deployment (one long-lived Node
 * process on Railway) but NOT for a multi-instance deployment, where each
 * instance would enforce the limit independently and the effective limit
 * would multiply by the instance count. Scaling out requires shared state
 * (e.g. Redis) before this limiter can be trusted again.
 *
 * @param options - Optional `limit` (requests per window, default 60) and
 *   `windowMs` (window length, default 60 000 ms).
 */
export class McpRateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly windows = new Map<string, WindowState>()

  constructor(options: McpRateLimiterOptions = {}) {
    this.limit = options.limit ?? DEFAULT_LIMIT
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  }

  /**
   * Record one request for a principal and decide whether it may proceed.
   *
   * @param principal - Stable identifier of the caller (the resolved userId).
   * @param now - Clock override for deterministic tests, defaults to Date.now().
   * @returns Whether the request is allowed and, when denied, how long to wait.
   */
  check(principal: string, now: number = Date.now()): McpRateDecision {
    this.sweep(now)

    const state = this.windows.get(principal)
    if (!state || now - state.windowStart >= this.windowMs) {
      this.windows.set(principal, { windowStart: now, count: 1 })
      return { allowed: true, retryAfterMs: 0 }
    }

    state.count += 1
    if (state.count <= this.limit) {
      return { allowed: true, retryAfterMs: 0 }
    }
    return {
      allowed: false,
      retryAfterMs: Math.max(state.windowStart + this.windowMs - now, 0),
    }
  }

  /**
   * Drop all recorded windows — intended for tests.
   */
  clear(): void {
    this.windows.clear()
  }

  private sweep(now: number): void {
    if (this.windows.size < SWEEP_THRESHOLD) return
    for (const [key, state] of this.windows) {
      if (now - state.windowStart >= this.windowMs) this.windows.delete(key)
    }
  }
}

function resolveConfiguredLimit(): number {
  const raw = process.env.MCP_RATE_LIMIT
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT
}

/**
 * Process-wide limiter shared by every /mcp request, configured via the
 * optional MCP_RATE_LIMIT env var (requests per minute, default 60).
 */
export const mcpRateLimiter = new McpRateLimiter({
  limit: resolveConfiguredLimit(),
})
