import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
    mcpRateLimitWindow: { deleteMany: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

import { McpRateLimiter, sweepStaleRateLimitWindows } from "./rate-limit"

interface StoredWindow {
  windowStart: number
  count: number
}

/**
 * Fake `$queryRaw` that reproduces the atomicity Postgres gives the real
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement: the whole
 * "read current window, decide reset-or-increment, write it back" step
 * happens synchronously inside one microtask, exactly like a single SQL
 * statement executing under one row lock. Two `check()` calls racing via
 * `Promise.all` therefore cannot interleave mid-decision — the first call's
 * mutation is fully applied before the second call's mutation starts,
 * which is the same guarantee the real UPSERT provides.
 */
function fakeAtomicUpsert() {
  const store = new Map<string, StoredWindow>()
  const fn = vi.fn(
    async (
      _strings: TemplateStringsArray,
      principal: string,
      nowDate: Date,
      cutoff: Date,
    ) => {
      const now = nowDate.getTime()
      const existing = store.get(principal)
      const stillInWindow = existing && existing.windowStart > cutoff.getTime()
      const next: StoredWindow = stillInWindow
        ? { windowStart: existing.windowStart, count: existing.count + 1 }
        : { windowStart: now, count: 1 }
      store.set(principal, next)
      return [{ count: next.count, windowStart: new Date(next.windowStart) }]
    },
  )
  return { fn, store }
}

describe("McpRateLimiter.check", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("allows requests up to the limit within one window", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 3, windowMs: 1000 })

    expect((await limiter.check("u1", 0)).allowed).toBe(true)
    expect((await limiter.check("u1", 10)).allowed).toBe(true)
    expect((await limiter.check("u1", 20)).allowed).toBe(true)
  })

  it("blocks past the threshold with a retry delay", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 2, windowMs: 1000 })

    await limiter.check("u1", 0)
    await limiter.check("u1", 100)
    const denied = await limiter.check("u1", 200)

    expect(denied.allowed).toBe(false)
    expect(denied.retryAfterMs).toBe(800)
    expect(denied.unavailable).toBeUndefined()
  })

  it("recovers once the window has elapsed", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })

    await limiter.check("u1", 0)
    expect((await limiter.check("u1", 500)).allowed).toBe(false)
    expect((await limiter.check("u1", 1000)).allowed).toBe(true)
  })

  it("tracks principals independently", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })

    expect((await limiter.check("u1", 0)).allowed).toBe(true)
    expect((await limiter.check("u1", 10)).allowed).toBe(false)
    expect((await limiter.check("u2", 20)).allowed).toBe(true)
  })

  it("keeps blocking within the same window after repeated attempts", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })

    await limiter.check("u1", 0)
    for (const at of [100, 200, 300]) {
      expect((await limiter.check("u1", at)).allowed).toBe(false)
    }
  })

  it("defaults to 60 requests per minute", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter()

    for (let i = 0; i < 60; i += 1) {
      expect((await limiter.check("u1", i)).allowed).toBe(true)
    }
    expect((await limiter.check("u1", 60)).allowed).toBe(false)
    expect((await limiter.check("u1", 60_000)).allowed).toBe(true)
  })

  it("does not let two concurrent requests both pass the exact boundary", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })

    const [first, second] = await Promise.all([
      limiter.check("u1", 0),
      limiter.check("u1", 0),
    ])

    const allowedCount = [first, second].filter((d) => d.allowed).length
    expect(allowedCount).toBe(1)
  })

  it("does not let ten concurrent requests all pass a limit of one", async () => {
    const { fn } = fakeAtomicUpsert()
    prismaMock.$queryRaw.mockImplementation(fn)
    const limiter = new McpRateLimiter({ limit: 1, windowMs: 1000 })

    const decisions = await Promise.all(
      Array.from({ length: 10 }, () => limiter.check("u1", 0)),
    )

    expect(decisions.filter((d) => d.allowed)).toHaveLength(1)
  })

  it("fails closed when the database check throws", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"))
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    const limiter = new McpRateLimiter({ limit: 60, windowMs: 60_000 })

    const decision = await limiter.check("u1", 0)

    expect(decision.allowed).toBe(false)
    expect(decision.unavailable).toBe(true)
    expect(decision.retryAfterMs).toBe(60_000)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("fails closed when the upsert returns no row", async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    const limiter = new McpRateLimiter({ limit: 60, windowMs: 60_000 })

    const decision = await limiter.check("u1", 0)

    expect(decision.allowed).toBe(false)
    expect(decision.unavailable).toBe(true)
    consoleSpy.mockRestore()
  })
})

describe("McpRateLimiter.clear", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes only the given principal's row", async () => {
    prismaMock.mcpRateLimitWindow.deleteMany.mockResolvedValue({ count: 1 })
    const limiter = new McpRateLimiter()

    await limiter.clear("u1")

    expect(prismaMock.mcpRateLimitWindow.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    })
  })

  it("deletes every row when no principal is given", async () => {
    prismaMock.mcpRateLimitWindow.deleteMany.mockResolvedValue({ count: 3 })
    const limiter = new McpRateLimiter()

    await limiter.clear()

    expect(prismaMock.mcpRateLimitWindow.deleteMany).toHaveBeenCalledWith({})
  })
})

describe("sweepStaleRateLimitWindows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes rows untouched for over 24h and returns the count", async () => {
    prismaMock.mcpRateLimitWindow.deleteMany.mockResolvedValue({ count: 2 })
    const now = new Date("2026-07-28T12:00:00.000Z").getTime()

    const deleted = await sweepStaleRateLimitWindows(now)

    expect(deleted).toBe(2)
    const [arg] = prismaMock.mcpRateLimitWindow.deleteMany.mock.calls[0] as [
      { where: { updatedAt: { lt: Date } } },
    ]
    expect(arg.where.updatedAt.lt.toISOString()).toBe(
      "2026-07-27T12:00:00.000Z",
    )
  })
})
