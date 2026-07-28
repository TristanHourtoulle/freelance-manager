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
      lastSync: string | null
    }
    expect(structured.kpi.revenueMonth).toBe(0)
    expect(structured.kpi.pipelineEur).toBe(0)
    expect(structured.months).toHaveLength(8)
    expect(structured.overdue).toEqual([])
    expect(structured.lastSync).toBeNull()
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
})
