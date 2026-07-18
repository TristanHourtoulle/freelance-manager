import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (d: number | null | undefined) => (d == null ? null : d),
}))

import {
  computeDashboardKpis,
  type DashboardKpiInput,
  type PaymentBucketRow,
} from "./kpis"

const NOW = new Date(2026, 2, 15, 12, 0, 0)

/**
 * Fixed dataset exercising every KPI path: overdue filtering (SENT + unpaid +
 * past due), the outstanding/overdue sums, distinct pipeline clients, the
 * trailing 8-month buckets, and the recent-invoice projection.
 */
function buildInput(): DashboardKpiInput {
  const currentMonthBucket = new Date(2026, 2, 1)
  const januaryBucket = new Date(2026, 0, 1)
  const paymentBuckets: PaymentBucketRow[] = [
    { month: currentMonthBucket, total: 1200 },
    { month: januaryBucket, total: 500 },
  ]

  return {
    now: NOW,
    openInvoices: [
      {
        id: "inv-a",
        number: "F-A",
        clientId: "c1",
        status: "SENT",
        paymentStatus: "UNPAID",
        total: 1000,
        dueDate: new Date(2026, 1, 1),
        payments: [],
      },
      {
        id: "inv-b",
        number: "F-B",
        clientId: "c2",
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        total: 500,
        dueDate: new Date(2026, 3, 1),
        payments: [{ amount: 200, paidAt: new Date(2026, 2, 1) }],
      },
      {
        id: "inv-c",
        number: "F-C",
        clientId: "c1",
        status: "SENT",
        paymentStatus: "UNPAID",
        total: 800,
        dueDate: new Date(2026, 2, 10),
        payments: [],
      },
    ],
    paymentTotals: [
      {
        paid_count: BigInt(5),
        paid_count_month: BigInt(2),
        revenue_month: 1200,
        revenue_year: 9000,
      },
    ],
    paymentBuckets,
    pipelineTasks: [
      { estimate: 2, billingMode: "DAILY", rate: 500 },
      { estimate: 1, billingMode: "DAILY", rate: 500 },
      { estimate: 3, billingMode: "HOURLY", rate: 100 },
      { estimate: 5, billingMode: "FIXED", rate: 1000 },
    ],
    pipelineClients: [{ clientId: "c1" }, { clientId: "c2" }],
    recentInvoices: [
      {
        id: "inv-r",
        number: "F-R",
        kind: "STANDARD",
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        issueDate: new Date(2026, 2, 5),
        dueDate: new Date(2026, 1, 20),
        total: 600,
        client: {
          firstName: "Ada",
          lastName: "Lovelace",
          company: "Analytical",
          color: "#abc",
        },
        payments: [{ amount: 100, paidAt: new Date(2026, 2, 5) }],
      },
    ],
  }
}

describe("computeDashboardKpis", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("derives the KPI totals from the queried rows", () => {
    const { kpi } = computeDashboardKpis(buildInput())

    expect(kpi).toEqual({
      revenueMonth: 1200,
      revenueYear: 9000,
      paidCount: 5,
      paidCountMonth: 2,
      outstanding: 2100,
      sentCount: 3,
      overdueAmount: 1800,
      overdueCount: 2,
      pipelineCount: 4,
      pipelineEur: 3900,
      pipelineClientCount: 2,
    })
  })

  it("sums the pipeline value across DAILY and HOURLY tasks, excluding FIXED", () => {
    const { kpi } = computeDashboardKpis(buildInput())

    expect(kpi.pipelineCount).toBe(4)
    expect(kpi.pipelineEur).toBe(3900)
  })

  it("lists only overdue invoices with their balance due", () => {
    const { overdue } = computeDashboardKpis(buildInput())

    expect(overdue).toEqual([
      {
        id: "inv-a",
        number: "F-A",
        clientId: "c1",
        total: 1000,
        dueDate: new Date(2026, 1, 1).toISOString(),
      },
      {
        id: "inv-c",
        number: "F-C",
        clientId: "c1",
        total: 800,
        dueDate: new Date(2026, 2, 10).toISOString(),
      },
    ])
  })

  it("builds the trailing eight-month payment buckets", () => {
    const { months } = computeDashboardKpis(buildInput())

    const bucketByMonth = new Map<string, number>([
      [new Date(2026, 2, 1).toISOString().slice(0, 7), 1200],
      [new Date(2026, 0, 1).toISOString().slice(0, 7), 500],
    ])
    const expected: { month: string; total: number; isCurrent: boolean }[] = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
      const key = start.toISOString().slice(0, 7)
      expected.push({
        month: start.toLocaleDateString("fr-FR", { month: "short" }),
        total: bucketByMonth.get(key) ?? 0,
        isCurrent: i === 0,
      })
    }

    expect(months).toHaveLength(8)
    expect(months).toEqual(expected)
    expect(months[7]?.isCurrent).toBe(true)
    expect(months[7]?.total).toBe(1200)
  })

  it("projects recent invoices with computed billing state", () => {
    const { recentInvoices } = computeDashboardKpis(buildInput())

    expect(recentInvoices).toEqual([
      {
        id: "inv-r",
        number: "F-R",
        kind: "STANDARD",
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        isOverdue: true,
        issueDate: new Date(2026, 2, 5).toISOString(),
        total: 600,
        balanceDue: 500,
        client: {
          firstName: "Ada",
          lastName: "Lovelace",
          company: "Analytical",
          color: "#abc",
        },
      },
    ])
  })

  it("returns zeroed KPIs when there are no rows", () => {
    const { kpi, overdue, recentInvoices } = computeDashboardKpis({
      now: NOW,
      openInvoices: [],
      paymentTotals: [],
      paymentBuckets: [],
      pipelineTasks: [],
      pipelineClients: [],
      recentInvoices: [],
    })

    expect(kpi).toEqual({
      revenueMonth: 0,
      revenueYear: 0,
      paidCount: 0,
      paidCountMonth: 0,
      outstanding: 0,
      sentCount: 0,
      overdueAmount: 0,
      overdueCount: 0,
      pipelineCount: 0,
      pipelineEur: 0,
      pipelineClientCount: 0,
    })
    expect(overdue).toEqual([])
    expect(recentInvoices).toEqual([])
  })
})
