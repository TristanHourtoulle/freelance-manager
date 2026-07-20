import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computeQuoteKpis } from "@/domain/quotes/kpis"

type InvoiceRow = {
  id: string
  clientId: string
  status: string
  paymentStatus: string
  issueDate: Date
  total: number
}
type PaymentRow = { invoiceId: string; amount: number; paidAt: Date }
type ClientRow = {
  id: string
  firstName: string
  lastName: string
  company: string | null
  color: string
  billingMode: string
  stage?: "LEAD" | "ACTIVE" | "DORMANT"
}
type TaskRow = {
  id: string
  completedAt: Date | null
  status: string
  invoiceId: string | null
  clientId: string
  estimate: number | null
  actualDays: number | null
}
type MonthBucket = { month: Date; total: number }
type QuoteRow = {
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED"
  sentAt: Date | null
  decidedAt: Date | null
  total: number
}

type Dataset = {
  invoices: InvoiceRow[]
  payments: PaymentRow[]
  clients: ClientRow[]
  tasks: TaskRow[]
  quotes?: QuoteRow[]
  paidByMonth: MonthBucket[]
  issuedByMonth: MonthBucket[]
}

const findMany = vi.fn()
const queryRaw = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    invoice: { findMany: (...a: unknown[]) => findMany("invoice", ...a) },
    payment: { findMany: (...a: unknown[]) => findMany("payment", ...a) },
    client: { findMany: (...a: unknown[]) => findMany("client", ...a) },
    task: { findMany: (...a: unknown[]) => findMany("task", ...a) },
    quote: { findMany: (...a: unknown[]) => findMany("quote", ...a) },
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
    decimalToNumber: (d: number | null | undefined) =>
      d == null
        ? null
        : typeof d === "number"
          ? d
          : (d as { toNumber(): number }).toNumber(),
  }
})

/**
 * Faithful copy of the pre-refactor aggregation algorithm, kept in the test as
 * the parity oracle. The refactored route must return byte-identical output.
 */
function referenceAnalytics(
  data: Dataset,
  today: Date,
  months: number,
  rangeKey: string,
) {
  const { invoices, payments, clients, tasks, paidByMonth, issuedByMonth } =
    data

  const paidByMonthMap = new Map(
    paidByMonth.map((b) => [b.month.toISOString().slice(0, 7), b.total]),
  )
  const issuedByMonthMap = new Map(
    issuedByMonth.map((b) => [b.month.toISOString().slice(0, 7), b.total]),
  )
  const monthBuckets: {
    label: string
    paid: number
    issued: number
    isCurrent: boolean
  }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const key = start.toISOString().slice(0, 7)
    monthBuckets.push({
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
      paid: paidByMonthMap.get(key) ?? 0,
      issued: issuedByMonthMap.get(key) ?? 0,
      isCurrent: i === 0,
    })
  }

  const totalRevenue = monthBuckets.reduce((s, m) => s + m.paid, 0)
  const avgRevenue = months > 0 ? Math.round(totalRevenue / months) : 0
  const lastMonth = monthBuckets.at(-1)?.paid ?? 0
  const prevMonth = monthBuckets.at(-2)?.paid ?? lastMonth
  const trend =
    prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0

  const paidByInvoice = new Map<string, number>()
  for (const p of payments) {
    paidByInvoice.set(
      p.invoiceId,
      (paidByInvoice.get(p.invoiceId) ?? 0) + (p.amount ?? 0),
    )
  }
  const revByClient = new Map<string, number>()
  for (const inv of invoices) {
    const paid = paidByInvoice.get(inv.id) ?? 0
    if (paid > 0)
      revByClient.set(inv.clientId, (revByClient.get(inv.clientId) ?? 0) + paid)
  }
  const byClient = clients
    .map((c) => ({
      client: {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        company: c.company,
        color: c.color,
      },
      revenue: revByClient.get(c.id) ?? 0,
    }))
    .filter((x) => x.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((x) => {
      const days = tasks.reduce((sum, t) => {
        if (t.clientId !== x.client.id) return sum
        const effort = t.actualDays != null ? t.actualDays : t.estimate
        return effort == null ? sum : sum + effort
      }, 0)
      return {
        ...x,
        days,
        effectiveRate: days > 0 ? Math.round(x.revenue / days) : null,
      }
    })

  const billingModeRev = { DAILY: 0, FIXED: 0, HOURLY: 0 }
  for (const c of clients) {
    const r = revByClient.get(c.id) ?? 0
    billingModeRev[c.billingMode as keyof typeof billingModeRev] += r
  }
  const byType = (
    [
      { type: "DAILY", revenue: billingModeRev.DAILY },
      { type: "FIXED", revenue: billingModeRev.FIXED },
      { type: "HOURLY", revenue: billingModeRev.HOURLY },
    ] as const
  ).filter((x) => x.revenue > 0)

  const weekCount = 12
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const startOfWeek0 = new Date(today)
  startOfWeek0.setHours(0, 0, 0, 0)
  startOfWeek0.setDate(
    startOfWeek0.getDate() - ((startOfWeek0.getDay() + 6) % 7),
  )
  const weeks = []
  for (let i = weekCount - 1; i >= 0; i--) {
    const wStart = new Date(startOfWeek0.getTime() - i * weekMs)
    const wEnd = new Date(wStart.getTime() + weekMs)
    const done = tasks.filter(
      (t) => t.completedAt && t.completedAt >= wStart && t.completedAt < wEnd,
    ).length
    const invoiced = tasks.filter(
      (t) =>
        t.completedAt &&
        t.completedAt >= wStart &&
        t.completedAt < wEnd &&
        t.invoiceId,
    ).length
    const w = new Date(wStart)
    const oneJan = new Date(w.getFullYear(), 0, 1)
    const weekNum = Math.ceil(
      ((w.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
    )
    weeks.push({ label: `S${weekNum}`, done, invoiced })
  }

  const heatmap = []
  for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
    const row = []
    for (let i = weekCount - 1; i >= 0; i--) {
      const wStart = new Date(startOfWeek0.getTime() - i * weekMs)
      const dayStart = new Date(wStart.getTime() + dayIdx * 24 * 60 * 60 * 1000)
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
      const count = tasks.filter(
        (t) =>
          t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd,
      ).length
      row.push(count)
    }
    heatmap.push(row)
  }

  const fullyPaidInvoices = invoices.filter(
    (inv) => inv.paymentStatus === "PAID" || inv.paymentStatus === "OVERPAID",
  )
  const delays = fullyPaidInvoices
    .map((inv) => {
      const invPayments = payments.filter((p) => p.invoiceId === inv.id)
      if (!invPayments.length) return null
      const last = invPayments.reduce(
        (max, p) => (p.paidAt > max ? p.paidAt : max),
        invPayments[0]!.paidAt,
      )
      return Math.round(
        (last.getTime() - inv.issueDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    })
    .filter((x): x is number => x !== null && x >= 0)
  const avgDelay =
    delays.length > 0
      ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length)
      : 0

  const sentCount = invoices.filter(
    (inv) =>
      inv.status === "SENT" &&
      (inv.paymentStatus === "UNPAID" ||
        inv.paymentStatus === "PARTIALLY_PAID"),
  ).length
  const collectionRate =
    fullyPaidInvoices.length + sentCount > 0
      ? Math.round(
          (fullyPaidInvoices.length / (fullyPaidInvoices.length + sentCount)) *
            100,
        )
      : 0

  const avgInvoice =
    fullyPaidInvoices.length > 0
      ? Math.round(totalRevenue / fullyPaidInvoices.length)
      : 0

  const quoteKpis = computeQuoteKpis(
    (data.quotes ?? []).map((q) => ({
      status: q.status,
      sentAt: q.sentAt?.toISOString() ?? null,
      decidedAt: q.decidedAt?.toISOString() ?? null,
      total: q.total,
    })),
  )

  return {
    range: rangeKey,
    months: monthBuckets,
    kpi: {
      totalRevenue,
      avgRevenue,
      trend,
      paidCount: fullyPaidInvoices.length,
      avgDelay,
      avgInvoice,
      collectionRate,
      winRate: quoteKpis.winRate,
      avgDecisionDays: quoteKpis.avgDecisionDays,
      runRate: avgRevenue * 12,
    },
    byClient,
    byType,
    weeks,
    heatmap,
  }
}

function buildDataset(): Dataset {
  const clients: ClientRow[] = [
    {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      color: "#123456",
      billingMode: "DAILY",
    },
    {
      id: "c2",
      firstName: "Alan",
      lastName: "Turing",
      company: null,
      color: "#abcdef",
      billingMode: "FIXED",
    },
    {
      id: "c3",
      firstName: "Grace",
      lastName: "Hopper",
      company: "Navy",
      color: "#0f0f0f",
      billingMode: "HOURLY",
    },
  ]
  const invoices: InvoiceRow[] = [
    {
      id: "i1",
      clientId: "c1",
      status: "PAID",
      paymentStatus: "PAID",
      issueDate: new Date(2026, 1, 1),
      total: 1200,
    },
    {
      id: "i2",
      clientId: "c2",
      status: "PAID",
      paymentStatus: "OVERPAID",
      issueDate: new Date(2026, 1, 10),
      total: 3000,
    },
    {
      id: "i3",
      clientId: "c3",
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      issueDate: new Date(2026, 2, 1),
      total: 800,
    },
    {
      id: "i4",
      clientId: "c1",
      status: "SENT",
      paymentStatus: "UNPAID",
      issueDate: new Date(2026, 2, 5),
      total: 500,
    },
    {
      id: "i5",
      clientId: "c2",
      status: "PAID",
      paymentStatus: "PAID",
      issueDate: new Date(2026, 0, 20),
      total: 0,
    },
  ]
  const payments: PaymentRow[] = [
    { invoiceId: "i1", amount: 600, paidAt: new Date(2026, 1, 15) },
    { invoiceId: "i1", amount: 600, paidAt: new Date(2026, 1, 20) },
    { invoiceId: "i2", amount: 3200, paidAt: new Date(2026, 1, 12) },
    { invoiceId: "i3", amount: 300, paidAt: new Date(2026, 2, 8) },
  ]
  const tasks: TaskRow[] = [
    {
      id: "t1",
      completedAt: new Date(2026, 2, 9),
      status: "done",
      invoiceId: "i1",
      clientId: "c1",
      estimate: 2,
      actualDays: 3,
    },
    {
      id: "t2",
      completedAt: new Date(2026, 2, 15),
      status: "done",
      invoiceId: null,
      clientId: "c1",
      estimate: 1,
      actualDays: null,
    },
    {
      id: "t3",
      completedAt: new Date(2026, 2, 2),
      status: "done",
      invoiceId: "i2",
      clientId: "c2",
      estimate: 4,
      actualDays: 0,
    },
    {
      id: "t4",
      completedAt: new Date(2026, 1, 10),
      status: "done",
      invoiceId: null,
      clientId: "c2",
      estimate: null,
      actualDays: null,
    },
    {
      id: "t5",
      completedAt: new Date(2026, 1, 10),
      status: "done",
      invoiceId: "i3",
      clientId: "c3",
      estimate: 1.5,
      actualDays: null,
    },
    {
      id: "t6",
      completedAt: new Date(2025, 5, 1),
      status: "done",
      invoiceId: null,
      clientId: "c1",
      estimate: 5,
      actualDays: 5,
    },
    {
      id: "t7",
      completedAt: null,
      status: "backlog",
      invoiceId: null,
      clientId: "c3",
      estimate: null,
      actualDays: null,
    },
  ]
  const paidByMonth: MonthBucket[] = [
    { month: new Date(Date.UTC(2026, 0, 1)), total: 0 },
    { month: new Date(Date.UTC(2026, 1, 1)), total: 4400 },
    { month: new Date(Date.UTC(2026, 2, 1)), total: 300 },
  ]
  const issuedByMonth: MonthBucket[] = [
    { month: new Date(Date.UTC(2026, 0, 1)), total: 0 },
    { month: new Date(Date.UTC(2026, 1, 1)), total: 4200 },
    { month: new Date(Date.UTC(2026, 2, 1)), total: 1300 },
  ]
  return {
    invoices,
    payments,
    clients,
    tasks,
    quotes: [],
    paidByMonth,
    issuedByMonth,
  }
}

function wireMocks(data: Dataset) {
  findMany.mockImplementation((model: string, args?: { where?: unknown }) => {
    switch (model) {
      case "invoice":
        return Promise.resolve(data.invoices)
      case "payment":
        return Promise.resolve(data.payments)
      case "client": {
        const where = (args?.where ?? {}) as { stage?: { not?: string } }
        if (where.stage?.not === "LEAD") {
          return Promise.resolve(data.clients.filter((c) => c.stage !== "LEAD"))
        }
        return Promise.resolve(data.clients)
      }
      case "task":
        return Promise.resolve(data.tasks)
      case "quote":
        return Promise.resolve(data.quotes ?? [])
      default:
        return Promise.resolve([])
    }
  })
  queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join("")
    return Promise.resolve(
      sql.includes("issueDate") ? data.issuedByMonth : data.paidByMonth,
    )
  })
}

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0))
    findMany.mockReset()
    queryRaw.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns output byte-identical to the reference algorithm (12m)", async () => {
    const data = buildDataset()
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=12m"),
    )
    const body = await res.json()
    const expected = referenceAnalytics(
      data,
      new Date(2026, 2, 15, 12),
      12,
      "12m",
    )
    expect(body).toEqual(expected)
  })

  it("matches the reference algorithm for a 3m range", async () => {
    const data = buildDataset()
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=3m"),
    )
    const body = await res.json()
    const expected = referenceAnalytics(
      data,
      new Date(2026, 2, 15, 12),
      3,
      "3m",
    )
    expect(body).toEqual(expected)
  })

  it("excludes LEAD clients from the revenue attribution query", async () => {
    const data = buildDataset()
    wireMocks(data)
    const { GET } = await import("./route")
    await GET(new Request("http://localhost/api/analytics?range=12m"))

    const clientCall = findMany.mock.calls.find((c) => c[0] === "client")
    expect(clientCall).toBeDefined()
    expect(
      (clientCall![1] as { where: Record<string, unknown> }).where,
    ).toEqual({
      userId: "user-1",
      archivedAt: null,
      stage: { not: "LEAD" },
    })
  })

  it("keeps a revenue-bearing LEAD out of byClient and byType", async () => {
    const data = buildDataset()
    data.clients.push({
      id: "c4",
      firstName: "Lea",
      lastName: "Prospect",
      company: "Lead SAS",
      color: "#999999",
      billingMode: "DAILY",
      stage: "LEAD",
    })
    data.invoices.push({
      id: "i6",
      clientId: "c4",
      status: "PAID",
      paymentStatus: "PAID",
      issueDate: new Date(2026, 1, 2),
      total: 9999,
    })
    data.payments.push({
      invoiceId: "i6",
      amount: 9999,
      paidAt: new Date(2026, 1, 3),
    })
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=12m"),
    )
    const body = await res.json()

    expect(
      body.byClient.some(
        (x: { client: { id: string } }) => x.client.id === "c4",
      ),
    ).toBe(false)
    const daily = body.byType.find((x: { type: string }) => x.type === "DAILY")
    expect(daily?.revenue ?? 0).toBe(1200)
  })

  it("exposes the payment collection rate as collectionRate", async () => {
    const data = buildDataset()
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=12m"),
    )
    const body = await res.json()
    expect(body.kpi.collectionRate).toBe(60)
    expect(body.kpi.conversion).toBeUndefined()
  })

  it("surfaces the quote win rate and decision delay in the KPI payload", async () => {
    const data = buildDataset()
    data.quotes = [
      {
        status: "ACCEPTED",
        sentAt: new Date(2026, 1, 1),
        decidedAt: new Date(2026, 1, 5),
        total: 4000,
      },
      {
        status: "REFUSED",
        sentAt: new Date(2026, 1, 1),
        decidedAt: new Date(2026, 1, 3),
        total: 1000,
      },
      {
        status: "SENT",
        sentAt: new Date(2026, 2, 1),
        decidedAt: null,
        total: 2500,
      },
    ]
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=12m"),
    )
    const body = await res.json()

    expect(body.kpi.winRate).toBe(50)
    expect(body.kpi.avgDecisionDays).toBe(3)
  })

  it("collapses multiple payments into one delay per invoice", async () => {
    const data = buildDataset()
    wireMocks(data)
    const { GET } = await import("./route")
    const res = await GET(
      new Request("http://localhost/api/analytics?range=12m"),
    )
    const body = await res.json()
    expect(body.kpi.paidCount).toBe(3)
    expect(body.kpi.avgDelay).toBeGreaterThan(0)
  })
})
