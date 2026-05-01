import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { rateLimit, _cleanup } from "@/lib/rate-limit"

function makeRequest(ip?: string): Request {
  const headers = new Headers()
  if (ip) {
    headers.set("x-forwarded-for", ip)
  }
  return new Request("http://localhost/api/test", { headers })
}

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns success for requests within the limit", () => {
    const request = makeRequest("10.0.0.1")

    const result = rateLimit(request, { limit: 5, windowMs: 60_000 })

    expect(result.success).toBe(true)
  })

  it("returns remaining count correctly", () => {
    const request = makeRequest("10.0.0.2")

    const first = rateLimit(request, { limit: 5, windowMs: 60_000 })
    expect(first.remaining).toBe(4)

    const second = rateLimit(request, { limit: 5, windowMs: 60_000 })
    expect(second.remaining).toBe(3)

    const third = rateLimit(request, { limit: 5, windowMs: 60_000 })
    expect(third.remaining).toBe(2)
  })

  it("returns success=false when limit is exceeded", () => {
    const request = makeRequest("10.0.0.3")
    const options = { limit: 2, windowMs: 60_000 }

    rateLimit(request, options)
    rateLimit(request, options)
    const result = rateLimit(request, options)

    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("respects custom limit and window options", () => {
    const request = makeRequest("10.0.0.4")
    const options = { limit: 1, windowMs: 10_000 }

    const first = rateLimit(request, options)
    expect(first.success).toBe(true)
    expect(first.remaining).toBe(0)

    const second = rateLimit(request, options)
    expect(second.success).toBe(false)
  })

  it("resets after window expires", () => {
    const request = makeRequest("10.0.0.5")
    const options = { limit: 1, windowMs: 5_000 }

    const first = rateLimit(request, options)
    expect(first.success).toBe(true)

    const blocked = rateLimit(request, options)
    expect(blocked.success).toBe(false)

    vi.advanceTimersByTime(6_000)

    const afterReset = rateLimit(request, options)
    expect(afterReset.success).toBe(true)
    expect(afterReset.remaining).toBe(0)
  })

  describe("IP extraction", () => {
    it("extracts the first IP from x-forwarded-for with multiple IPs", () => {
      const headers = new Headers()
      headers.set("x-forwarded-for", "192.168.1.1, 10.0.0.1, 172.16.0.1")
      const request = new Request("http://localhost/api/test", { headers })

      const result = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result.success).toBe(true)

      const otherRequest = makeRequest("10.0.0.99")
      const otherResult = rateLimit(otherRequest, {
        limit: 1,
        windowMs: 60_000,
      })
      expect(otherResult.success).toBe(true)
    })

    it("falls back to x-real-ip when x-forwarded-for is absent", () => {
      const headers = new Headers()
      headers.set("x-real-ip", "  203.0.113.50  ")
      const request = new Request("http://localhost/api/test", { headers })

      const result = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result.success).toBe(true)

      const result2 = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result2.success).toBe(false)
    })

    it("returns 'unknown' when no IP headers are present", () => {
      const request = new Request("http://localhost/api/test")

      const result = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result.success).toBe(true)

      const request2 = new Request("http://localhost/api/other")
      const result2 = rateLimit(request2, { limit: 1, windowMs: 60_000 })
      expect(result2.success).toBe(false)
    })

    it("handles empty x-forwarded-for first segment gracefully", () => {
      const headers = new Headers()
      headers.set("x-forwarded-for", "")
      headers.set("x-real-ip", "empty-fwd-test-ip")
      const request = new Request("http://localhost/api/test", { headers })

      const result = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result.success).toBe(true)

      const result2 = rateLimit(request, { limit: 1, windowMs: 60_000 })
      expect(result2.success).toBe(false)
    })
  })

  describe("cleanup", () => {
    it("removes expired entries from the store", () => {
      const request1 = makeRequest("cleanup-test-1")
      const request2 = makeRequest("cleanup-test-2")
      const options = { limit: 2, windowMs: 5_000 }

      rateLimit(request1, options)
      rateLimit(request2, options)

      expect(rateLimit(request1, options).remaining).toBe(0)
      expect(rateLimit(request2, options).remaining).toBe(0)

      vi.advanceTimersByTime(6_000)

      _cleanup()

      const afterCleanup1 = rateLimit(request1, options)
      expect(afterCleanup1.success).toBe(true)
      expect(afterCleanup1.remaining).toBe(1)

      const afterCleanup2 = rateLimit(request2, options)
      expect(afterCleanup2.success).toBe(true)
      expect(afterCleanup2.remaining).toBe(1)
    })

    it("does not remove entries that have not yet expired", () => {
      const request = makeRequest("cleanup-test-3")
      const options = { limit: 3, windowMs: 10_000 }

      rateLimit(request, options)

      vi.advanceTimersByTime(5_000)

      _cleanup()

      const result = rateLimit(request, options)
      expect(result.remaining).toBe(1)
    })
  })
})
