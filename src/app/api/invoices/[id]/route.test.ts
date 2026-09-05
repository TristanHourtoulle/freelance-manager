import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findFirst: vi.fn(), update: vi.fn() },
    project: { findFirst: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

vi.mock("@/lib/payments", () => ({
  getInvoiceComputed: vi.fn(),
  recomputeInvoicePayment: vi.fn(),
  serializePayment: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("@/lib/data/invoices", () => ({
  invoicesTag: (id: string) => `user-${id}-invoices`,
  getInvoicesFirstPage: vi.fn(),
}))
vi.mock("@/lib/data/clients", () => ({
  clientsTag: (id: string) => `user-${id}-clients`,
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("@/lib/invoice-numbering", () => ({ nextAutoNumber: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

import { getInvoiceComputed, serializePayment } from "@/lib/payments"

const INVOICE_ID = "inv-1"

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/invoices/${INVOICE_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "DRAFT",
      kind: "STANDARD",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      ...body,
    }),
  })
}

const routeParams = { params: Promise.resolve({ id: INVOICE_ID }) }

describe("PATCH /api/invoices/[id] — task re-binding", () => {
  const tx = {
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    taskGroup: { updateMany: vi.fn() },
    invoiceLine: { deleteMany: vi.fn() },
    invoice: { update: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "c1",
      status: "DRAFT",
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    )
    tx.task.findMany.mockImplementation(async (args) =>
      args.where.id.in.map((id: string) => ({
        id,
        taskGroupId: null,
        status: "PENDING_INVOICE",
        billable: true,
        invoiceId: null,
      })),
    )
  })

  it("returns a removed-line task to the pipeline while a kept-line task stays attached", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({
        lines: [{ taskId: "t-kept", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.task.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.task.updateMany.mock.calls[0]![0]).toEqual({
      where: { invoiceId: INVOICE_ID, userId: "user-1" },
      data: { invoiceId: null, status: "PENDING_INVOICE" },
    })
    expect(tx.task.updateMany.mock.calls[1]![0]).toEqual({
      where: { id: { in: ["t-kept"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: INVOICE_ID, status: "DONE" },
    })
  })

  it("detaches before deleting lines and re-attaching, inside the transaction", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    const detachOrder = tx.task.updateMany.mock.invocationCallOrder[0]!
    const deleteLinesOrder =
      tx.invoiceLine.deleteMany.mock.invocationCallOrder[0]!
    const reattachOrder = tx.task.updateMany.mock.invocationCallOrder[1]!
    expect(detachOrder).toBeLessThan(deleteLinesOrder)
    expect(deleteLinesOrder).toBeLessThan(reattachOrder)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it("re-attaches the deduplicated union of taskIds and line taskIds", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
        taskIds: ["t1", "t2"],
      }),
      routeParams,
    )

    expect(tx.task.updateMany.mock.calls[1]![0].where.id).toEqual({
      in: ["t1", "t2"],
    })
  })

  it("still re-attaches tasks selected via taskIds without a matching line", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ label: "Forfait", qty: 1, rate: 500 }],
        taskIds: ["t2"],
      }),
      routeParams,
    )

    expect(tx.task.updateMany.mock.calls[1]![0]).toEqual({
      where: { id: { in: ["t2"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: INVOICE_ID, status: "DONE" },
    })
  })

  it("only detaches when nothing references a task anymore", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({ lines: [{ label: "Forfait", qty: 1, rate: 500 }] }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.task.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.task.updateMany.mock.calls[0]![0].data).toEqual({
      invoiceId: null,
      status: "PENDING_INVOICE",
    })
  })

  it("releases groups removed from the edited invoice", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({
        lines: [{ label: "Audit", qty: 1, rate: 500 }],
        taskGroupIds: [],
      }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.taskGroup.updateMany).toHaveBeenCalledWith({
      where: {
        invoiceId: INVOICE_ID,
        userId: "user-1",
        id: { notIn: [] },
      },
      data: { invoiceId: null },
    })
  })

  it("scopes the re-attach query to the authenticated user and invoice client", async () => {
    getAuthUser.mockResolvedValue({ id: "user-9" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "c7",
      status: "DRAFT",
    })
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t-foreign", label: "Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    const where = tx.task.updateMany.mock.calls[1]![0].where
    expect(where.userId).toBe("user-9")
    expect(where.clientId).toBe("c7")
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({ lines: [{ label: "Dev", qty: 1, rate: 500 }] }),
      routeParams,
    )

    expect(res.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("GET /api/invoices/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "client-1",
      projectId: null,
      client: {
        id: "client-1",
        firstName: "Jean",
        lastName: "Dupont",
        company: null,
        email: null,
        billingMode: "DAILY",
        color: null,
      },
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      kind: "STANDARD",
      issueDate: new Date("2026-07-01"),
      dueDate: new Date("2026-07-31"),
      subtotal: 5000,
      tax: 0,
      total: 5000,
      totalOverride: null,
      notes: null,
      lines: [],
      taskGroups: [],
      lateFeeFixed: 44.94,
      lateFeeInterest: 0,
      lateFeeClaimedAt: new Date("2026-09-01"),
      lateFeeWaived: false,
      payments: [],
    })
    prismaMock.userSettings.findUnique.mockResolvedValue({
      lateFeeFixedAmount: 40,
      lateFeeAnnualRate: 0.1,
    })
    vi.mocked(getInvoiceComputed).mockReturnValue({
      paidAmount: 4495.06,
      balanceDue: 504.94,
      isOverdue: true,
      lastPaidAt: "2026-08-01T00:00:00.000Z",
      lateFeeDue: 44.94,
      lateFeeAccrued: 44.94,
      penaltyPaid: 0,
    })
    vi.mocked(serializePayment).mockImplementation((p) => ({
      id: p.id,
      amount: 0,
      paidAt: "2026-08-01T00:00:00.000Z",
      method: null,
      note: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      penaltyAmount: 0,
    }))
  })

  it("serializes the frozen and live late-fee fields on the wire", async () => {
    const { GET } = await import("./route")
    const res = await GET(
      new Request(`http://localhost/api/invoices/${INVOICE_ID}`),
      {
        params: Promise.resolve({ id: INVOICE_ID }),
      },
    )
    const body = (await res.json()) as {
      lateFeeAccrued: number
      lateFeeDue: number
      lateFeeClaimedAt: string | null
      lateFeeWaived: boolean
      penaltyPaid: number
    }

    expect(res.status).toBe(200)
    expect(body.lateFeeAccrued).toBe(44.94)
    expect(body.lateFeeDue).toBe(44.94)
    expect(body.lateFeeClaimedAt).toBe("2026-09-01T00:00:00.000Z")
    expect(body.lateFeeWaived).toBe(false)
    expect(body.penaltyPaid).toBe(0)
  })

  it("returns a live lateFeeBreakdown for an unclaimed penalty, using the real UserSettings policy", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T00:00:00.000Z"))

    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "client-1",
      projectId: null,
      client: {
        id: "client-1",
        firstName: "Jean",
        lastName: "Dupont",
        company: null,
        email: null,
        billingMode: "DAILY",
        color: null,
      },
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      kind: "STANDARD",
      issueDate: new Date("2026-07-14"),
      dueDate: new Date("2026-08-14"),
      subtotal: 5460,
      tax: 0,
      total: 5460,
      totalOverride: null,
      notes: null,
      lines: [],
      taskGroups: [],
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: false,
      payments: [
        { amount: 1000, paidAt: new Date("2026-07-31") },
        { amount: 1000, paidAt: new Date("2026-08-21") },
        { amount: 2550, paidAt: new Date("2026-08-31") },
        { amount: 629, paidAt: new Date("2026-09-02") },
        { amount: 325.94, paidAt: new Date("2026-09-04") },
      ],
    })

    const { GET } = await import("./route")
    const res = await GET(
      new Request(`http://localhost/api/invoices/${INVOICE_ID}`),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    const body = (await res.json()) as {
      lateFeeBreakdown: {
        daysLate: number
        fixed: number
        interest: number
        total: number
        segments: {
          from: string
          to: string
          days: number
          outstanding: number
        }[]
      } | null
    }

    vi.useRealTimers()

    expect(res.status).toBe(200)
    expect(body.lateFeeBreakdown).not.toBeNull()
    expect(body.lateFeeBreakdown?.daysLate).toBe(21)
    expect(body.lateFeeBreakdown?.fixed).toBe(40)
    expect(body.lateFeeBreakdown?.interest).toBe(18.69)
    expect(body.lateFeeBreakdown?.total).toBe(58.69)
    expect(body.lateFeeBreakdown?.segments).toHaveLength(4)
    expect(body.lateFeeBreakdown?.segments[0]).toMatchObject({
      from: "2026-08-14T00:00:00.000Z",
      to: "2026-08-21T00:00:00.000Z",
      days: 7,
      outstanding: 4460,
    })
  })

  it("freezes fixed/interest/total to the claimed row for a claim of less than what accrued (5460 total, 44,94 claimed vs 58,69 accrued)", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "client-1",
      projectId: null,
      client: {
        id: "client-1",
        firstName: "Jean",
        lastName: "Dupont",
        company: null,
        email: null,
        billingMode: "DAILY",
        color: null,
      },
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      kind: "STANDARD",
      issueDate: new Date("2026-07-14"),
      dueDate: new Date("2026-08-14"),
      subtotal: 5460,
      tax: 0,
      total: 5460,
      totalOverride: null,
      notes: null,
      lines: [],
      taskGroups: [],
      lateFeeFixed: 40,
      lateFeeInterest: 4.94,
      lateFeeClaimedAt: new Date("2026-09-04T00:00:00.000Z"),
      lateFeeWaived: false,
      payments: [
        { amount: 1000, paidAt: new Date("2026-07-31") },
        { amount: 1000, paidAt: new Date("2026-08-21") },
        { amount: 2550, paidAt: new Date("2026-08-31") },
        { amount: 629, paidAt: new Date("2026-09-02") },
        { amount: 325.94, paidAt: new Date("2026-09-04") },
      ],
    })

    const { GET } = await import("./route")
    const res = await GET(
      new Request(`http://localhost/api/invoices/${INVOICE_ID}`),
      { params: Promise.resolve({ id: INVOICE_ID }) },
    )
    const body = (await res.json()) as {
      lateFeeBreakdown: {
        daysLate: number
        fixed: number
        interest: number
        total: number
        segments: unknown[]
      } | null
    }

    expect(res.status).toBe(200)
    expect(body.lateFeeBreakdown).not.toBeNull()
    expect(body.lateFeeBreakdown?.daysLate).toBe(21)
    expect(body.lateFeeBreakdown?.fixed).toBe(40)
    expect(body.lateFeeBreakdown?.interest).toBe(4.94)
    expect(body.lateFeeBreakdown?.total).toBe(44.94)
    expect(body.lateFeeBreakdown?.segments).toHaveLength(4)
  })
})
