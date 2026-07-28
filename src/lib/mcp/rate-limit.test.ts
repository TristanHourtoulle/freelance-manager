import { describe, expect, it } from "vitest"
import { McpRateLimiter } from "./rate-limit"

describe("McpRateLimiter", () => {
  it("allows requests up to the limit within one window", () => {
    const limiter = new McpRateLimiter({ limit: 3, windowMs: 1000 })
    expect(limiter.check("u1", 0).allowed).toBe(true)
    expect(limiter.check("u1", 10).allowed).toBe(true)
    expect(limiter.check("u1", 20).allowed).toBe(true)
  })

  it("blocks past the threshold with a retry delay", () => {
    const limiter = new McpRateLimiter({ limit: 2, windowMs: 1000 })
    limiter.check("u1", 0)
    limiter.check("u1", 100)
    const denied = limiter.check("u1", 200)
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBe(800)
  })

  it("recovers once the window has elapsed", () => {
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check("u1", 0)
    expect(limiter.check("u1", 500).allowed).toBe(false)
    expect(limiter.check("u1", 1000).allowed).toBe(true)
  })

  it("tracks principals independently", () => {
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })
    expect(limiter.check("u1", 0).allowed).toBe(true)
    expect(limiter.check("u1", 10).allowed).toBe(false)
    expect(limiter.check("u2", 20).allowed).toBe(true)
  })

  it("keeps blocking within the same window after repeated attempts", () => {
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check("u1", 0)
    for (const at of [100, 200, 300]) {
      expect(limiter.check("u1", at).allowed).toBe(false)
    }
  })

  it("clear() resets all state", () => {
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })
    limiter.check("u1", 0)
    expect(limiter.check("u1", 10).allowed).toBe(false)
    limiter.clear()
    expect(limiter.check("u1", 20).allowed).toBe(true)
  })

  it("defaults to 60 requests per minute", () => {
    const limiter = new McpRateLimiter()
    for (let i = 0; i < 60; i += 1) {
      expect(limiter.check("u1", i).allowed).toBe(true)
    }
    expect(limiter.check("u1", 60).allowed).toBe(false)
    expect(limiter.check("u1", 60_000).allowed).toBe(true)
  })
})
