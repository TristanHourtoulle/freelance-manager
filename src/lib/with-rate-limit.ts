import { NextResponse } from "next/server"

import { rateLimit } from "@/lib/rate-limit"
import type { RateLimitOptions } from "@/lib/rate-limit"

/**
 * Wraps an API route handler with rate limiting.
 * Returns a 429 response when the limit is exceeded.
 *
 * @param handler - The original route handler
 * @param options - Optional rate limit configuration
 * @returns A wrapped handler that enforces rate limits
 */
export function withRateLimit(
  handler: (req: Request, ...args: unknown[]) => Promise<NextResponse>,
  options?: RateLimitOptions,
) {
  return async (req: Request, ...args: unknown[]): Promise<NextResponse> => {
    const result = rateLimit(req, options)

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.reset / 1000)),
            "X-RateLimit-Remaining": String(result.remaining),
          },
        },
      )
    }

    return handler(req, ...args)
  }
}

export type { RateLimitOptions }
