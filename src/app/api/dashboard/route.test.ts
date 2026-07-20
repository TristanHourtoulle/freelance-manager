import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const invoiceFindMany = vi.fn()
const taskFindMany = vi.fn()
const taskCount = vi.fn()
const userSettingsFindUnique = vi.fn()
const queryRaw = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: (...a: unknown[]) => invoiceFindMany(...a) },
    task: {
      findMany: (...a: unknown[]) => taskFindMany(...a),
      count: (...a: unknown[]) => taskCount(...a),
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
} as const

type TaskFindManyArgs = {
  where?: { status?: string | { in?: string[] } }
  select?: { clientId?: boolean; estimate?: boolean; completedAt?: boolean }
}

/**
 * Route runs four `task.findMany` calls (pipeline, open workload, recently
 * completed and in-progress) through one mock; branch on the where clause
 * status to return each dataset, the open-workload call resolving empty.
 */
function mockTaskFindMany(
  pipeline: unknown[],
  recent: unknown[],
  inProgress: unknown[] = [],
) {
  taskFindMany.mockImplementation((args: TaskFindManyArgs) => {
    const status = args?.where?.status
    if (status === "PENDING_INVOICE") return Promise.resolve(pipeline)
    if (status === "IN_PROGRESS") return Promise.resolve(inProgress)
    if (typeof status === "object" && status !== null) {
      return Promise.resolve([])
    }
    return Promise.resolve(recent)
  })
}

function mockPaymentTotals(
  totals: {
    paid_count: bigint
    paid_count_month: bigint
    paid_count_year: bigint
    revenue_month: number
    revenue_year: number
  } = {
    paid_count: BigInt(0),
    paid_count_month: BigInt(0),
    paid_count_year: BigInt(0),
    revenue_month: 0,
    revenue_year: 0,
  },
) {
  queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join("")
    return Promise.resolve(sql.includes("date_trunc") ? [] : [totals])
  })
}

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
    invoiceFindMany.mockReset()
    taskFindMany.mockReset()
    taskCount.mockReset()
    taskCount.mockResolvedValue(0)
    userSettingsFindUnique.mockReset()
    queryRaw.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("derives pipeline count, value and client count from pending tasks", async () => {
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany(
      [
        {
          clientId: "c1",
          estimate: 2,
          completedAt: null,
          client: { billingMode: "DAILY", rate: 500 },
        },
        {
          clientId: "c2",
          estimate: 3,
          completedAt: null,
          client: { billingMode: "HOURLY", rate: 100 },
        },
        {
          clientId: "c2",
          estimate: 1,
          completedAt: null,
          client: { billingMode: "HOURLY", rate: 100 },
        },
      ],
      [],
    )
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(3)
    expect(body.kpi.pipelineEur).toBe(4200)
    expect(body.kpi.pipelineClientCount).toBe(2)

    const pipelineCall = taskFindMany.mock.calls.find(
      (c) => (c[0] as TaskFindManyArgs)?.where?.status === "PENDING_INVOICE",
    )
    const pipelineArgs = pipelineCall?.[0] as TaskFindManyArgs
    expect(pipelineArgs.where).toEqual(PENDING_WHERE)
    expect(pipelineArgs.select?.clientId).toBe(true)
    expect(pipelineArgs.select?.completedAt).toBe(true)
    expect(taskFindMany).toHaveBeenCalledTimes(4)
  })

  it("counts FIXED pending tasks without adding to the pipeline value", async () => {
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany(
      [
        {
          clientId: "c1",
          estimate: 2,
          completedAt: null,
          client: { billingMode: "DAILY", rate: 500 },
        },
        {
          clientId: "c4",
          estimate: 6,
          completedAt: null,
          client: { billingMode: "FIXED", rate: 900 },
        },
      ],
      [],
    )
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.pipelineCount).toBe(2)
    expect(body.kpi.pipelineEur).toBe(1000)
    expect(body.kpi.pipelineClientCount).toBe(2)
  })

  it("scopes the yearly paid count to payments made this year", async () => {
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany([], [])
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals({
      paid_count: BigInt(12),
      paid_count_month: BigInt(2),
      paid_count_year: BigInt(7),
      revenue_month: 1200,
      revenue_year: 9000,
    })

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.kpi.paidCount).toBe(12)
    expect(body.kpi.paidCountMonth).toBe(2)
    expect(body.kpi.paidCountYear).toBe(7)

    const totalsCall = queryRaw.mock.calls.find(
      (c) => !(c[0] as TemplateStringsArray).join("").includes("date_trunc"),
    )
    const sql = (totalsCall?.[0] as TemplateStringsArray).join("")
    expect(sql).toContain("paid_count_year")
    expect(totalsCall?.[2]).toEqual(new Date(2026, 0, 1))
  })

  it("returns a zeroed pipeline when there are no pending tasks", async () => {
    invoiceFindMany.mockResolvedValue([])
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

  it("returns the in-progress task count and top rows", async () => {
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany(
      [],
      [],
      [
        {
          id: "t1",
          linearIdentifier: "TRI-1",
          linearUrl: "https://linear.app/x",
          title: "Refactor",
          project: { key: "TRI" },
        },
      ],
    )
    taskCount.mockResolvedValue(7)
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.inProgress.count).toBe(7)
    expect(body.inProgress.top).toEqual([
      {
        id: "t1",
        linearIdentifier: "TRI-1",
        linearUrl: "https://linear.app/x",
        title: "Refactor",
        projectKey: "TRI",
      },
    ])
    expect(taskCount).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "IN_PROGRESS" },
    })
  })

  it("ages the pipeline from the task completion dates", async () => {
    const dayMs = 86_400_000
    const now = new Date(2026, 2, 15, 12, 0, 0).getTime()
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany(
      [
        {
          clientId: "c1",
          estimate: 2,
          completedAt: new Date(now - 3 * dayMs),
          client: { billingMode: "DAILY", rate: 500 },
        },
        {
          clientId: "c2",
          estimate: 1,
          completedAt: new Date(now - 60 * dayMs),
          client: { billingMode: "DAILY", rate: 500 },
        },
        {
          clientId: "c3",
          estimate: 1,
          completedAt: null,
          client: { billingMode: "DAILY", rate: 500 },
        },
      ],
      [],
    )
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.pipelineAging.oldestDays).toBe(60)
    expect(body.pipelineAging.staleCount).toBe(1)
    expect(body.pipelineAging.staleValue).toBe(500)
    expect(body.pipelineAging.buckets).toEqual({
      fresh: 1,
      warm: 0,
      stale: 1,
      undated: 1,
    })
  })

  it("returns an empty aging profile with no pending tasks", async () => {
    invoiceFindMany.mockResolvedValue([])
    mockTaskFindMany([], [])
    userSettingsFindUnique.mockResolvedValue({ linearLastSyncedAt: null })
    mockPaymentTotals()

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body.pipelineAging).toEqual({
      oldestDays: null,
      staleCount: 0,
      staleValue: 0,
      buckets: { fresh: 0, warm: 0, stale: 0, undated: 0 },
    })
  })
})
