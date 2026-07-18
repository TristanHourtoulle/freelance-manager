import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invoiceFindMany = vi.fn()
const taskGroupBy = vi.fn()
const taskFindMany = vi.fn()
const userSettingsFindUnique = vi.fn()
const queryRaw = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: (...a: unknown[]) => invoiceFindMany(...a) },
    task: {
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

const PENDING_WHERE = {
  userId: "user-1",
  status: "PENDING_INVOICE",
  client: { billingMode: { in: ["DAILY", "HOURLY"] } },
} as const

type TaskFindManyArgs = {
  where?: { status?: string }
  select?: { estimate?: boolean }
}

/**
 * Route runs two `task.findMany` calls (pipeline + recently completed) through
 * one mock; branch on the pending-invoice where clause to return each dataset.
 */
function mockTaskFindMany(pipeline: unknown[], recent: unknown[]) {
  taskFindMany.mockImplementation((args: TaskFindManyArgs) =>
    Promise.resolve(args?.where?.status === "PENDING_INVOICE" ? pipeline : recent),
  )
}

function mockPaymentTotals() {
  queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join("")
    return Promise.resolve(
      sql.includes("date_trunc")
        ? []
        : [
            {
              paid_count: BigInt(0),
              paid_count_month: BigInt(0),
              revenue_month: 0,
              revenue_year: 0,
            },
          ],
    )
  })
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
    invoiceFindMany.mockReset()
    taskGroupBy.mockReset()
    taskFindMany.mockReset()
    userSettingsFindUnique.mockReset()
    queryRaw.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("derives pipeline count, value and client count from pending tasks", async () => {
    invoiceFindMany.mockResolvedValue([])
    taskGroupBy.mockResolvedValue([
      { clientId: "c1" },
      { clientId: "c2" },
      { clientId: "c3" },
    ])
    mockTaskFindMany(
      [
        { estimate: 2, client: { billingMode: "DAILY", rate: 500 } },
        { estimate: 3, client: { billingMode: "HOURLY", rate: 100 } },
      ],
      [],
    )
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(2)
    expect(body.kpi.pipelineEur).toBe(3400)
    expect(body.kpi.pipelineClientCount).toBe(3)

    const pipelineCall = taskFindMany.mock.calls.find(
      (c) => (c[0] as TaskFindManyArgs)?.where?.status === "PENDING_INVOICE",
    )
    expect((pipelineCall?.[0] as { where: unknown }).where).toEqual(
      PENDING_WHERE,
    )
    const groupByArgs = taskGroupBy.mock.calls[0]?.[0]
    expect(groupByArgs?.by).toEqual(["clientId"])
    expect(groupByArgs?.where).toEqual(PENDING_WHERE)
  })

  it("returns a zeroed pipeline when there are no pending tasks", async () => {
    invoiceFindMany.mockResolvedValue([])
    taskGroupBy.mockResolvedValue([])
    mockTaskFindMany([], [])
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(0)
    expect(body.kpi.pipelineEur).toBe(0)
    expect(body.kpi.pipelineClientCount).toBe(0)
  })
})
