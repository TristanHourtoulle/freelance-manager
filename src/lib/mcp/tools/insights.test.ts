import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    invoice: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
    client: { findMany: vi.fn() },
    task: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

import { getAnalytics, getDashboard } from "./insights"

const USER_ID = "user-1"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
  prismaMock.invoice.findMany.mockResolvedValue([])
  prismaMock.payment.findMany.mockResolvedValue([])
  prismaMock.client.findMany.mockResolvedValue([])
  prismaMock.task.findMany.mockResolvedValue([])
  prismaMock.quote.findMany.mockResolvedValue([])
  prismaMock.userSettings.findUnique.mockResolvedValue(null)
  prismaMock.$queryRaw.mockResolvedValue([])
})

describe("getDashboard", () => {
  it("returns the KPI snapshot without any task or project free text", async () => {
    const result = await getDashboard(USER_ID)
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent as {
      kpi: { revenueMonth: number; pipelineEur: number }
      months: unknown[]
      overdue: unknown[]
      lastSyncedAt: string | null
      syncStale: boolean
      syncAgeMinutes: number | null
    }
    expect(structured.kpi.revenueMonth).toBe(0)
    expect(structured.kpi.pipelineEur).toBe(0)
    expect(structured.months).toHaveLength(8)
    expect(structured.overdue).toEqual([])
    expect(structured.lastSyncedAt).toBeNull()
    expect(structured.syncStale).toBe(true)
    expect(structured.syncAgeMinutes).toBeNull()
    const serialized = JSON.stringify(result.structuredContent)
    expect(serialized).not.toContain('"description"')
    expect(serialized).not.toContain('"runbook"')
  })

  it("writes an audit row for the call", async () => {
    await getDashboard(USER_ID)
    const entry = prismaMock.activityLog.create.mock.calls[0]![0] as {
      data: { kind: string; title: string }
    }
    expect(entry.data.kind).toBe("MCP_TOOL_CALL")
    expect(entry.data.title).toBe("Appel MCP get_dashboard (succès)")
  })

  it("selects the late-fee columns, so a claimed penalty is never dropped", async () => {
    await getDashboard(USER_ID)
    const [args] = prismaMock.invoice.findMany.mock.calls[0] ?? []
    const select = (args as { select: Record<string, unknown> }).select
    expect(select).toMatchObject({
      lateFeeFixed: true,
      lateFeeInterest: true,
      lateFeeClaimedAt: true,
      lateFeeWaived: true,
    })
    expect(
      (select.payments as { select: Record<string, unknown> }).select,
    ).toMatchObject({ penaltyAmount: true })
  })

  it("passes the operator's real late-fee policy into the accrual preview", async () => {
    prismaMock.userSettings.findUnique.mockResolvedValue({
      linearLastSyncedAt: null,
      lateFeeFixedAmount: 25,
      lateFeeAnnualRate: 0,
    })
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        number: "F-1",
        clientId: "client-1",
        status: "SENT",
        paymentStatus: "UNPAID",
        total: 1000,
        dueDate: new Date("2026-01-01T00:00:00Z"),
        lateFeeFixed: 0,
        lateFeeInterest: 0,
        lateFeeClaimedAt: null,
        lateFeeWaived: false,
        payments: [],
      },
    ])
    const result = await getDashboard(USER_ID)
    const { kpi } = result.structuredContent as {
      kpi: { lateFeeAccrued: number }
    }
    expect(kpi.lateFeeAccrued).toBe(25)
  })
})

describe("getAnalytics", () => {
  it("builds one month bucket per month of the requested range", async () => {
    const result = await getAnalytics(USER_ID, { range: "3m" })
    expect(result.isError).toBeUndefined()
    const structured = result.structuredContent as {
      range: string
      months: unknown[]
      kpi: { totalRevenue: number }
      byClient: unknown[]
    }
    expect(structured.range).toBe("3m")
    expect(structured.months).toHaveLength(3)
    expect(structured.kpi.totalRevenue).toBe(0)
    expect(structured.byClient).toEqual([])
  })

  it("truncates client display names in byClient", async () => {
    prismaMock.client.findMany.mockResolvedValue([
      {
        id: "client-1",
        firstName: "Marie",
        lastName: "Durand",
        company: "c".repeat(400),
        billingMode: "DAILY",
      },
    ])
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        clientId: "client-1",
        status: "SENT",
        paymentStatus: "PAID",
        issueDate: new Date("2026-07-01T00:00:00Z"),
      },
    ])
    prismaMock.payment.findMany.mockResolvedValue([
      {
        invoiceId: "inv-1",
        amount: 1000,
        paidAt: new Date("2026-07-10T00:00:00Z"),
      },
    ])
    const result = await getAnalytics(USER_ID, { range: "12m" })
    const { byClient } = result.structuredContent as {
      byClient: { name: string; revenue: number }[]
    }
    expect(byClient).toHaveLength(1)
    expect(byClient[0]!.revenue).toBe(1000)
    expect(byClient[0]!.name).toHaveLength(121)
  })

  /**
   * Regression guard for TRI-1237: `getAnalytics` used to rebuild its own
   * month buckets with `new Date(y, m, 1)` (process-local time) read back
   * via `toISOString()` — a near-literal copy of the pre-TRI-1218 analytics
   * route logic, which shifts every key back a month under a positive UTC
   * offset. It now delegates to `buildMonthlyBuckets`, so the paid/issued
   * rows must key onto their own UTC month regardless of the server
   * process's timezone. `paidByMonth`/`issuedByMonth` are seeded here as
   * UTC month starts, matching what Postgres `date_trunc('month', ...)`
   * returns in production.
   */
  it("keys each month bucket by its own UTC month, independent of iteration order", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 6, 12, 0, 0)))
    try {
      prismaMock.$queryRaw
        .mockResolvedValueOnce([
          { month: new Date(Date.UTC(2026, 6, 1)), total: 1000 },
          { month: new Date(Date.UTC(2026, 7, 1)), total: 3550 },
          { month: new Date(Date.UTC(2026, 8, 1)), total: 954.94 },
        ])
        .mockResolvedValueOnce([])

      const result = await getAnalytics(USER_ID, { range: "3m" })
      const { months } = result.structuredContent as {
        months: {
          label: string
          paid: number
          issued: number
          isCurrent: boolean
        }[]
      }

      expect(months).toEqual([
        { label: "juil.", paid: 1000, issued: 0, isCurrent: false },
        { label: "août", paid: 3550, issued: 0, isCurrent: false },
        { label: "sept.", paid: 954.94, issued: 0, isCurrent: true },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})
