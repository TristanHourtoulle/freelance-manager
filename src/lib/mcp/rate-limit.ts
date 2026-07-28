import "server-only"
import { prisma } from "@/lib/db"

const DEFAULT_LIMIT = 60
const DEFAULT_WINDOW_MS = 60_000
const STALE_WINDOW_MS = 24 * 60 * 60 * 1000

export interface McpRateLimiterOptions {
  limit?: number
  windowMs?: number
}

export interface McpRateDecision {
  allowed: boolean
  retryAfterMs: number
  /**
   * Set when the decision was NOT computed from the database — the request
   * was refused because the limiter could not reach Postgres, not because
   * the principal is actually over quota. See the fail-closed rationale on
   * {@link McpRateLimiter.check}.
   */
  unavailable?: boolean
}

interface RateLimitRow {
  count: number
  windowStart: Date
}

/**
 * Postgres-backed fixed-window rate limiter keyed by principal.
 *
 * Replaces the previous in-process limiter, which was correct only for a
 * single Node instance: each Railway replica would otherwise enforce the
 * limit independently and the effective limit would multiply by the
 * instance count. State now lives in the `mcp_rate_limit_windows` table, so
 * every instance shares one view of the window.
 *
 * The whole "is this request still inside the window, and does it tip the
 * count over the limit" decision is a single `INSERT ... ON CONFLICT DO
 * UPDATE` statement (see `check`), never a read followed by a separate
 * write — that is what makes two concurrent requests hitting the boundary
 * safe: Postgres serializes concurrent upserts on the same row via its
 * normal row lock, so the second writer always observes the first writer's
 * committed count before deciding.
 *
 * @param options - Optional `limit` (requests per window, default 60) and
 *   `windowMs` (window length, default 60 000 ms).
 */
export class McpRateLimiter {
  private readonly limit: number
  private readonly windowMs: number

  constructor(options: McpRateLimiterOptions = {}) {
    this.limit = options.limit ?? DEFAULT_LIMIT
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS
  }

  /**
   * Record one request for a principal and decide whether it may proceed.
   *
   * FAIL CLOSED on a database error: the request is denied rather than
   * allowed through unlimited. Two reasons this is the right default here —
   * first, every MCP tool handler already queries Postgres, so a database
   * outage already breaks the endpoint's actual capability surface; denying
   * the request at the rate-limit gate does not remove any availability
   * beyond what is already lost. Second, this endpoint fronts an autonomous
   * agent that can retry in a tight loop; failing open on a DB blip would
   * turn a transient outage into an unbounded-cost/unbounded-load window
   * with no backstop. The 503 this maps to at the route layer is honest
   * about the cause (service unavailable) rather than pretending it is an
   * ordinary 429 the caller should just wait out.
   *
   * @param principal - Stable identifier of the caller (the resolved userId).
   * @param now - Clock override for deterministic tests, defaults to Date.now().
   * @returns Whether the request is allowed and, when denied, how long to
   *   wait — or that the decision itself could not be made.
   */
  async check(
    principal: string,
    now: number = Date.now(),
  ): Promise<McpRateDecision> {
    const nowDate = new Date(now)
    const cutoff = new Date(now - this.windowMs)

    let rows: RateLimitRow[]
    try {
      rows = await prisma.$queryRaw<RateLimitRow[]>`
        INSERT INTO "mcp_rate_limit_windows" ("userId", "windowStart", "count", "updatedAt")
        VALUES (${principal}, ${nowDate}, 1, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId") DO UPDATE SET
          "count" = CASE
            WHEN "mcp_rate_limit_windows"."windowStart" > ${cutoff}
            THEN "mcp_rate_limit_windows"."count" + 1
            ELSE 1
          END,
          "windowStart" = CASE
            WHEN "mcp_rate_limit_windows"."windowStart" > ${cutoff}
            THEN "mcp_rate_limit_windows"."windowStart"
            ELSE ${nowDate}
          END,
          "updatedAt" = CURRENT_TIMESTAMP
        RETURNING "count", "windowStart"
      `
    } catch (err) {
      console.error("[mcp] rate limit check failed, failing closed", err)
      return {
        allowed: false,
        retryAfterMs: this.windowMs,
        unavailable: true,
      }
    }

    const row = rows[0]
    if (!row) {
      console.error("[mcp] rate limit upsert returned no row, failing closed")
      return {
        allowed: false,
        retryAfterMs: this.windowMs,
        unavailable: true,
      }
    }

    if (row.count <= this.limit) {
      return { allowed: true, retryAfterMs: 0 }
    }
    return {
      allowed: false,
      retryAfterMs: Math.max(
        row.windowStart.getTime() + this.windowMs - now,
        0,
      ),
    }
  }

  /**
   * Delete recorded windows — intended for tests. With no principal, clears
   * every row.
   *
   * @param principal - When given, clears only this principal's row.
   */
  async clear(principal?: string): Promise<void> {
    if (principal) {
      await prisma.mcpRateLimitWindow.deleteMany({
        where: { userId: principal },
      })
      return
    }
    await prisma.mcpRateLimitWindow.deleteMany({})
  }
}

function resolveConfiguredLimit(): number {
  const raw = process.env.MCP_RATE_LIMIT
  if (!raw) return DEFAULT_LIMIT
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT
}

/**
 * Shared limiter used by every /mcp request, configured via the optional
 * MCP_RATE_LIMIT env var (requests per minute, default 60).
 */
export const mcpRateLimiter = new McpRateLimiter({
  limit: resolveConfiguredLimit(),
})

/**
 * Delete rate-limit window rows that have not been touched for over a day.
 *
 * Windows are at most `windowMs` (default 60s) wide, so anything untouched
 * for 24h is long expired; this only exists to keep the table from growing
 * unbounded, not to enforce correctness — the window logic in `check` is
 * self-contained and does not depend on stale rows being absent. Intended
 * to run once a day from `runDailyJobs`.
 *
 * @param now - Epoch ms reference point, injectable for deterministic tests.
 * @returns The number of rows deleted.
 */
export async function sweepStaleRateLimitWindows(
  now: number = Date.now(),
): Promise<number> {
  const cutoff = new Date(now - STALE_WINDOW_MS)
  const result = await prisma.mcpRateLimitWindow.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  })
  return result.count
}
