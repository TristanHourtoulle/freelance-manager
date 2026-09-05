import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    client: { count: vi.fn() },
    project: { count: vi.fn() },
    task: { count: vi.fn() },
    invoice: { count: vi.fn() },
    quote: { count: vi.fn() },
  },
}))

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

const { getNavCounts } = await import("./nav")

describe("getNavCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.client.count.mockResolvedValue(3)
    prismaMock.project.count.mockResolvedValue(2)
    prismaMock.task.count.mockResolvedValue(7)
    prismaMock.invoice.count.mockResolvedValue(4)
    prismaMock.quote.count.mockResolvedValue(5)
  })

  it("excludes LEAD clients from the sidebar client badge", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.client.count).toHaveBeenCalledWith({
      where: { userId: "user-1", archivedAt: null, stage: { not: "LEAD" } },
    })
  })

  it("counts the task badge through the canonical pipeline gate", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.task.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "PENDING_INVOICE",
        invoiceId: null,
        billable: true,
        client: { archivedAt: null, category: "FREELANCE" },
      },
    })
  })

  it("keeps the project and invoice counts unchanged", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.project.count).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "ACTIVE" },
    })
    expect(prismaMock.invoice.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "CANCELLED" },
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
    })
  })

  it("counts only non-expired SENT quotes for the quotes badge", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.quote.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "SENT",
        OR: [{ validUntil: null }, { validUntil: { gte: expect.any(Date) } }],
      },
    })
  })

  it("excludes a SENT quote whose validUntil is already in the past, ahead of the daily expiry cron", async () => {
    await getNavCounts("user-1")

    const [args] = prismaMock.quote.count.mock.calls[0] ?? []
    const where = (args as { where: { OR: { validUntil?: unknown }[] } })
      .where
    const gteClause = where.OR[1]?.validUntil as { gte: Date } | undefined
    expect(gteClause?.gte).toBeInstanceOf(Date)
  })

  it("returns the five counts", async () => {
    await expect(getNavCounts("user-1")).resolves.toEqual({
      clients: 3,
      projects: 2,
      tasks: 7,
      invoices: 4,
      quotes: 5,
    })
  })
})

interface FixtureQuote {
  userId: string
  status: string
  validUntil: Date | null
}

interface QuoteCountWhere {
  userId: string
  status: string
  OR: ({ validUntil: null } | { validUntil: { gte: Date } })[]
}

function countMatchingFixtures(
  fixtures: readonly FixtureQuote[],
  where: QuoteCountWhere,
): number {
  return fixtures.filter((q) => {
    if (q.userId !== where.userId || q.status !== where.status) return false
    return where.OR.some((clause) =>
      clause.validUntil === null
        ? q.validUntil == null
        : q.validUntil != null &&
          q.validUntil.getTime() >= clause.validUntil.gte.getTime(),
    )
  }).length
}

describe("getNavCounts — quotes badge same-day boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    prismaMock.client.count.mockResolvedValue(0)
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.task.count.mockResolvedValue(0)
    prismaMock.invoice.count.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("counts a quote whose validUntil is today, and excludes one whose validUntil was yesterday", async () => {
    vi.setSystemTime(new Date("2026-08-01T14:00:00.000Z"))
    const fixtures: FixtureQuote[] = [
      {
        userId: "user-1",
        status: "SENT",
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
      },
      {
        userId: "user-1",
        status: "SENT",
        validUntil: new Date("2026-07-31T00:00:00.000Z"),
      },
    ]
    prismaMock.quote.count.mockImplementation(
      ({ where }: { where: QuoteCountWhere }) =>
        Promise.resolve(countMatchingFixtures(fixtures, where)),
    )

    const counts = await getNavCounts("user-1")

    expect(counts.quotes).toBe(1)
  })

  it("still counts today's quote late in the UTC day, ahead of the cron", async () => {
    vi.setSystemTime(new Date("2026-08-01T20:00:00.000Z"))
    const fixtures: FixtureQuote[] = [
      {
        userId: "user-1",
        status: "SENT",
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]
    prismaMock.quote.count.mockImplementation(
      ({ where }: { where: QuoteCountWhere }) =>
        Promise.resolve(countMatchingFixtures(fixtures, where)),
    )

    const counts = await getNavCounts("user-1")

    expect(counts.quotes).toBe(1)
  })

  it("matches the cron's exact boundary: counted at the Paris end-of-day instant, dropped 1ms later", async () => {
    const fixtures: FixtureQuote[] = [
      {
        userId: "user-1",
        status: "SENT",
        validUntil: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]
    prismaMock.quote.count.mockImplementation(
      ({ where }: { where: QuoteCountWhere }) =>
        Promise.resolve(countMatchingFixtures(fixtures, where)),
    )

    vi.setSystemTime(new Date("2026-08-01T21:59:59.999Z"))
    expect((await getNavCounts("user-1")).quotes).toBe(1)

    vi.setSystemTime(new Date("2026-08-01T22:00:00.000Z"))
    expect((await getNavCounts("user-1")).quotes).toBe(0)
  })
})
