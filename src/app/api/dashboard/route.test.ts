import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invoiceFindMany = vi.fn()
const taskCount = vi.fn()
const taskGroupBy = vi.fn()
const taskFindMany = vi.fn()
const userSettingsFindUnique = vi.fn()
const queryRaw = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: (...a: unknown[]) => invoiceFindMany(...a) },
    task: {
      count: (...a: unknown[]) => taskCount(...a),
      groupBy: (...a: unknown[]) => taskGroupBy(...a),
      findMany: (...a: unknown[]) => taskFindMany(...a),
    },
    userSettings: {
      findUnique: (...a: unknown[]) => userSettingsFindUnique(...a),
    },
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      queryRaw(strings, ...values),
  },
}))

vi.mock("@/lib/api", async () => {
  const { NextResponse } = await import("next/server")
  return {
    getAuthUser: vi.fn(async () => ({
      id: "user-1",
      email: "u@example.com",
      name: "User",
    })),
    apiUnauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    apiServerError: (error: unknown) => {
      throw error
    },
    decimalToNumber: (d: number | null | undefined) => (d == null ? null : d),
  }
})

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
    invoiceFindMany.mockReset()
    taskCount.mockReset()
    taskGroupBy.mockReset()
    taskFindMany.mockReset()
    userSettingsFindUnique.mockReset()
    queryRaw.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("derives pipeline totals from task.count and task.groupBy", async () => {
    invoiceFindMany.mockResolvedValue([])
    taskCount.mockResolvedValue(7)
    taskGroupBy.mockResolvedValue([
      { clientId: "c1" },
      { clientId: "c2" },
      { clientId: "c3" },
    ])
    taskFindMany.mockResolvedValue([])
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join("")
      return Promise.resolve(
        sql.includes("date_trunc")
          ? []
          : [{ paid_count: BigInt(0), revenue_month: 0, revenue_year: 0 }],
      )
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(7)
    expect(body.kpi.pipelineClientCount).toBe(3)

    const countWhere = taskCount.mock.calls[0]?.[0]?.where
    const groupByArgs = taskGroupBy.mock.calls[0]?.[0]
    expect(countWhere).toEqual({
      userId: "user-1",
      status: "PENDING_INVOICE",
      client: { billingMode: { in: ["DAILY", "HOURLY"] } },
    })
    expect(groupByArgs?.by).toEqual(["clientId"])
    expect(groupByArgs?.where).toEqual(countWhere)
  })

  it("counts distinct clients only once per groupBy row", async () => {
    invoiceFindMany.mockResolvedValue([])
    taskCount.mockResolvedValue(0)
    taskGroupBy.mockResolvedValue([])
    taskFindMany.mockResolvedValue([])
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sql = strings.join("")
      return Promise.resolve(
        sql.includes("date_trunc")
          ? []
          : [{ paid_count: BigInt(0), revenue_month: 0, revenue_year: 0 }],
      )
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(0)
    expect(body.kpi.pipelineClientCount).toBe(0)
  })
})
