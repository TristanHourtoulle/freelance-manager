import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
    invoice: { findMany: vi.fn(), count: vi.fn() },
    clientAction: { createMany: vi.fn(), count: vi.fn() },
    meeting: { count: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const sendPushToUser = vi.fn()
vi.mock("@/lib/push/send", () => ({
  sendPushToUser: (userId: string, payload: unknown) =>
    sendPushToUser(userId, payload),
}))

const NOW = new Date("2026-07-20T07:00:00.000Z")
const PAST = new Date("2026-01-10T00:00:00.000Z")
const FUTURE = new Date("2999-01-01T00:00:00.000Z")

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    number: "FAC-2026-042",
    clientId: "cli-1",
    status: "SENT",
    paymentStatus: "UNPAID",
    total: 1200,
    dueDate: PAST,
    payments: [] as { amount: number; paidAt: Date }[],
    ...overrides,
  }
}

describe("runDailyJobs — overdue-relances", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }])
    prismaMock.clientAction.createMany.mockResolvedValue({ count: 1 })
    prismaMock.clientAction.count.mockResolvedValue(0)
    prismaMock.meeting.count.mockResolvedValue(0)
    prismaMock.invoice.count.mockResolvedValue(0)
    sendPushToUser.mockResolvedValue({ sent: 1, pruned: 0 })
  })

  it("creates one relance action for an overdue unpaid invoice", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([invoice()])

    const { runDailyJobs } = await import("./daily")
    const result = await runDailyJobs(NOW)

    expect(prismaMock.clientAction.createMany).toHaveBeenCalledTimes(1)
    const [arg] = prismaMock.clientAction.createMany.mock.calls[0] ?? []
    expect(arg.skipDuplicates).toBe(true)
    expect(arg.data).toHaveLength(1)
    expect(arg.data[0]).toMatchObject({
      type: "RELANCE",
      relanceInvoiceId: "inv-1",
      userId: "user-1",
    })
    expect(result.jobs).toContainEqual({
      name: "overdue-relances",
      ok: true,
      count: 1,
    })
  })

  it("is idempotent: a second run inserts nothing more", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([invoice()])
    prismaMock.clientAction.createMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    const { runDailyJobs } = await import("./daily")
    const first = await runDailyJobs(NOW)
    const second = await runDailyJobs(NOW)

    expect(first.jobs[0]).toEqual({
      name: "overdue-relances",
      ok: true,
      count: 1,
    })
    expect(second.jobs[0]).toEqual({
      name: "overdue-relances",
      ok: true,
      count: 0,
    })

    const rows = prismaMock.clientAction.createMany.mock.calls.flatMap(
      (call) => call[0].data as { relanceInvoiceId?: string }[],
    )
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.relanceInvoiceId).toBe("inv-1")
    }
  })

  it("skips invoices that are not yet due or already fully paid", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      invoice({ id: "inv-future", dueDate: FUTURE }),
      invoice({
        id: "inv-paid",
        payments: [{ amount: 1200, paidAt: PAST }],
      }),
    ])

    const { runDailyJobs } = await import("./daily")
    const result = await runDailyJobs(NOW)

    expect(prismaMock.clientAction.createMany).not.toHaveBeenCalled()
    expect(result.jobs[0]).toEqual({
      name: "overdue-relances",
      ok: true,
      count: 0,
    })
  })

  it("records a failing job without rejecting or aborting the run", async () => {
    prismaMock.invoice.findMany.mockRejectedValue(new Error("db down"))
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})

    const { runDailyJobs } = await import("./daily")
    const result = await runDailyJobs(NOW)

    expect(result.jobs).toContainEqual({
      name: "overdue-relances",
      ok: false,
      count: 0,
    })
    expect(typeof result.startedAt).toBe("string")
    expect(typeof result.finishedAt).toBe("string")
    spy.mockRestore()
  })
})

describe("runDailyJobs — push-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }])
    prismaMock.invoice.findMany.mockResolvedValue([])
    prismaMock.clientAction.createMany.mockResolvedValue({ count: 0 })
    sendPushToUser.mockResolvedValue({ sent: 1, pruned: 0 })
  })

  it("sends at most one notification per user regardless of item count", async () => {
    prismaMock.clientAction.count.mockResolvedValue(5)
    prismaMock.meeting.count.mockResolvedValue(3)
    prismaMock.invoice.count.mockResolvedValue(2)

    const { runDailyJobs } = await import("./daily")
    const result = await runDailyJobs(NOW)

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    const [userId, payload] = sendPushToUser.mock.calls[0] ?? []
    expect(userId).toBe("user-1")
    expect(payload).toEqual({
      title: "Aujourd'hui",
      body: "5 actions, 3 RDV, 2 factures en retard",
      url: "/dashboard",
    })
    expect(result.jobs).toContainEqual({
      name: "push-digest",
      ok: true,
      count: 1,
    })
  })

  it("sends nothing when there is nothing to report", async () => {
    prismaMock.clientAction.count.mockResolvedValue(0)
    prismaMock.meeting.count.mockResolvedValue(0)
    prismaMock.invoice.count.mockResolvedValue(0)

    const { runDailyJobs } = await import("./daily")
    const result = await runDailyJobs(NOW)

    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(result.jobs).toContainEqual({
      name: "push-digest",
      ok: true,
      count: 0,
    })
  })
})
