import { beforeEach, describe, expect, it, vi } from "vitest"

const queryRaw = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      queryRaw(strings, ...values),
  },
}))

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

const { getClientsBillableSummary } = await import("./clients")

describe("getClientsBillableSummary", () => {
  beforeEach(() => {
    queryRaw.mockReset()
  })

  it("scopes the aggregate to the user's uninvoiced PENDING_INVOICE tasks", async () => {
    queryRaw.mockResolvedValue([])

    await getClientsBillableSummary("user-1")

    const [strings, ...values] = queryRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ]
    const sql = strings.join("?")
    expect(sql).toContain("PENDING_INVOICE")
    expect(sql).toContain('t."invoiceId" IS NULL')
    expect(sql).toContain('GROUP BY t."clientId"')
    expect(values).toEqual(["user-1"])
  })

  it("issues a single grouped query, never one per client", async () => {
    queryRaw.mockResolvedValue([
      {
        clientId: "a",
        billingMode: "DAILY",
        rate: 500,
        taskCount: 2,
        estimateDays: 4,
      },
      {
        clientId: "b",
        billingMode: "HOURLY",
        rate: 80,
        taskCount: 1,
        estimateDays: 1,
      },
    ])

    const summary = await getClientsBillableSummary("user-1")

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(summary.byClient["a"]).toEqual({ count: 2, value: 2000 })
    expect(summary.byClient["b"]).toEqual({ count: 1, value: 640 })
    expect(summary.totalCount).toBe(3)
    expect(summary.totalValue).toBe(2640)
  })

  it("aggregates more than one page worth of tasks", async () => {
    queryRaw.mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        clientId: `client-${i}`,
        billingMode: "DAILY" as const,
        rate: 500,
        taskCount: 2,
        estimateDays: 2,
      })),
    )

    const summary = await getClientsBillableSummary("user-1")

    expect(summary.totalCount).toBe(120)
    expect(summary.totalValue).toBe(60_000)
    expect(summary.byClient["client-57"]).toEqual({ count: 2, value: 1000 })
  })

  it("normalizes decimal-like values coming back from the driver", async () => {
    queryRaw.mockResolvedValue([
      {
        clientId: "a",
        billingMode: "DAILY",
        rate: "500" as unknown as number,
        taskCount: "3" as unknown as number,
        estimateDays: "2" as unknown as number,
      },
    ])

    const summary = await getClientsBillableSummary("user-1")

    expect(summary.byClient["a"]).toEqual({ count: 3, value: 1000 })
  })
})

describe("getClientsBillableSummary — client stage", () => {
  beforeEach(() => {
    queryRaw.mockReset()
  })

  it("does not filter on the client stage, so a LEAD's pending tasks still count", async () => {
    queryRaw.mockResolvedValue([
      {
        clientId: "lead-1",
        billingMode: "DAILY",
        rate: 500,
        taskCount: 2,
        estimateDays: 3,
      },
    ])

    const summary = await getClientsBillableSummary("user-1")

    const [strings] = queryRaw.mock.calls[0] as [TemplateStringsArray]
    expect(strings.join("?")).not.toContain("stage")
    expect(summary.byClient["lead-1"]).toEqual({ count: 2, value: 1500 })
  })
})

describe("serializeClient", () => {
  it("emits the client stage on the wire row", async () => {
    const { serializeClient } = await import("@/domain/clients/serialize")

    const row = serializeClient({
      id: "c1",
      firstName: "Lea",
      lastName: "Prospect",
      company: null,
      email: null,
      phone: null,
      website: null,
      address: null,
      notes: null,
      billingMode: "DAILY",
      rate: 500 as unknown as never,
      fixedPrice: null,
      deposit: null,
      paymentTerms: null,
      category: "FREELANCE",
      stage: "LEAD",
      color: null,
      starred: false,
      archivedAt: null,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
    })

    expect(row.stage).toBe("LEAD")
  })
})
