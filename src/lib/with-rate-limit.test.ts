import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextResponse } from "next/server"

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}))

import { withRateLimit } from "./with-rate-limit"
import { rateLimit } from "@/lib/rate-limit"

const mockedRateLimit = vi.mocked(rateLimit)

function createRequest(ip = "127.0.0.1"): Request {
  return new Request("https://example.com/api/test", {
    headers: { "x-forwarded-for": ip },
  })
}

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls the handler when within rate limits", async () => {
    mockedRateLimit.mockReturnValue({
      success: true,
      remaining: 99,
      reset: 60000,
    })

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }))
    const wrapped = withRateLimit(handler)
    const req = createRequest()

    const response = await wrapped(req)

    expect(handler).toHaveBeenCalledWith(req)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
  })

  it("returns 429 when rate limit is exceeded", async () => {
    mockedRateLimit.mockReturnValue({
      success: false,
      remaining: 0,
      reset: 30000,
    })

    const handler = vi.fn()
    const wrapped = withRateLimit(handler)
    const req = createRequest()

    const response = await wrapped(req)

    expect(handler).not.toHaveBeenCalled()
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
  })

  it("sets Retry-After header on 429 response", async () => {
    mockedRateLimit.mockReturnValue({
      success: false,
      remaining: 0,
      reset: 15000,
    })

    const wrapped = withRateLimit(vi.fn())
    const response = await wrapped(createRequest())

    expect(response.headers.get("Retry-After")).toBe("15")
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
  })

  it("passes options to rateLimit", async () => {
    mockedRateLimit.mockReturnValue({
      success: true,
      remaining: 9,
      reset: 10000,
    })

    const handler = vi.fn().mockResolvedValue(NextResponse.json({}))
    const options = { limit: 10, windowMs: 10000 }
    const wrapped = withRateLimit(handler, options)
    const req = createRequest()

    await wrapped(req)

    expect(mockedRateLimit).toHaveBeenCalledWith(req, options)
  })

  it("forwards extra arguments to the handler", async () => {
    mockedRateLimit.mockReturnValue({
      success: true,
      remaining: 99,
      reset: 60000,
    })

    const handler = vi.fn().mockResolvedValue(NextResponse.json({}))
    const wrapped = withRateLimit(handler)
    const req = createRequest()
    const extraArg = { params: { id: "123" } }

    await wrapped(req, extraArg)

    expect(handler).toHaveBeenCalledWith(req, extraArg)
  })
})
