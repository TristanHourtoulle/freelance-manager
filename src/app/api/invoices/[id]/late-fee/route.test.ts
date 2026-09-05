import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, txMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findFirst: vi.fn() },
    userSettings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: {
    invoice: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    payment: { aggregate: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("@/lib/data/invoices", () => ({
  invoicesTag: (id: string) => `user-${id}-invoices`,
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const INVOICE_ID = "inv-1"
const NOW = new Date(2026, 2, 1, 12, 0, 0)
const PAST_DUE = new Date(2026, 0, 1)
const FUTURE_DUE = new Date(2026, 5, 1)

function postRequest(body?: Record<string, unknown>) {
  return new Request(`http://localhost/api/invoices/${INVOICE_ID}/late-fee`, {
    method: "POST",
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  })
}

function deleteRequest() {
  return new Request(`http://localhost/api/invoices/${INVOICE_ID}/late-fee`, {
    method: "DELETE",
  })
}

const routeParams = { params: Promise.resolve({ id: INVOICE_ID }) }

describe("POST /api/invoices/[id]/late-fee", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.userSettings.findUnique.mockResolvedValue({
      lateFeeFixedAmount: 40,
      lateFeeAnnualRate: 0,
    })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      payments: [],
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof txMock) => Promise<unknown>) => fn(txMock),
    )
    txMock.invoice.update.mockResolvedValue({})
    txMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      lateFeeFixed: 40,
      lateFeeInterest: 0,
      lateFeeClaimedAt: NOW,
      lateFeeWaived: false,
      payments: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("freezes the full accrued amount when no override is given", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)
    const body = (await res.json()) as {
      lateFeeFixed: number
      lateFeeInterest: number
      lateFeeDue: number
      lateFeeClaimedAt: string
      lateFeeWaived: boolean
      paymentStatus: string
      balanceDue: number
      isOverdue: boolean
    }

    expect(res.status).toBe(201)
    expect(txMock.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: {
        lateFeeFixed: 40,
        lateFeeInterest: 0,
        lateFeeClaimedAt: expect.any(Date),
        lateFeeWaived: false,
      },
    })
    expect(body.lateFeeFixed).toBe(40)
    expect(body.lateFeeInterest).toBe(0)
    expect(body.lateFeeDue).toBe(40)
    expect(body.lateFeeWaived).toBe(false)
    expect(body.paymentStatus).toBe("UNPAID")
    expect(body.balanceDue).toBe(1040)
    expect(body.isOverdue).toBe(true)
  })

  it("claims less than the accrued amount when given a partial override", async () => {
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      lateFeeFixed: 25,
      lateFeeInterest: 0,
      lateFeeClaimedAt: NOW,
      lateFeeWaived: false,
      payments: [],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest({ fixed: 25 }), routeParams)
    const body = (await res.json()) as { lateFeeFixed: number }

    expect(res.status).toBe(201)
    expect(txMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lateFeeFixed: 25, lateFeeInterest: 0 }),
      }),
    )
    expect(body.lateFeeFixed).toBe(25)
  })

  it("rejects an override above the accrued amount", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest({ fixed: 41 }), routeParams)

    expect(res.status).toBe(400)
    expect(txMock.invoice.update).not.toHaveBeenCalled()
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("returns 409 on a CANCELLED invoice", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "CANCELLED",
      dueDate: PAST_DUE,
      total: 1000,
      payments: [],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)

    expect(res.status).toBe(409)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("returns 400 when nothing has accrued", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "SENT",
      dueDate: FUTURE_DUE,
      total: 1000,
      payments: [],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)

    expect(res.status).toBe(400)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("refuses an invoice belonging to another userId", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null)

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)

    expect(res.status).toBe(404)
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INVOICE_ID, userId: "user-1" } }),
    )
  })

  it("flips an already-PAID invoice back to PARTIALLY_PAID with isOverdue true", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      payments: [{ amount: 1000, paidAt: new Date(2026, 0, 5) }],
    })
    txMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 1000 } })
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      lateFeeFixed: 40,
      lateFeeInterest: 0,
      lateFeeClaimedAt: NOW,
      lateFeeWaived: false,
      payments: [
        { amount: 1000, paidAt: new Date(2026, 0, 5), penaltyAmount: 0 },
      ],
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), routeParams)
    const body = (await res.json()) as {
      paymentStatus: string
      isOverdue: boolean
      balanceDue: number
    }

    expect(res.status).toBe(201)
    expect(body.paymentStatus).toBe("PARTIALLY_PAID")
    expect(body.isOverdue).toBe(true)
    expect(body.balanceDue).toBe(40)
  })
})

describe("DELETE /api/invoices/[id]/late-fee", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL

    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "SENT",
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof txMock) => Promise<unknown>) => fn(txMock),
    )
    txMock.invoice.update.mockResolvedValue({})
    txMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 500 } })
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({
      status: "SENT",
      dueDate: PAST_DUE,
      total: 1000,
      lateFeeFixed: 0,
      lateFeeInterest: 0,
      lateFeeClaimedAt: null,
      lateFeeWaived: true,
      payments: [
        { amount: 500, paidAt: new Date(2026, 1, 1), penaltyAmount: 0 },
      ],
    })
  })

  it("reverts a claimed penalty back to zero", async () => {
    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), routeParams)
    const body = (await res.json()) as {
      lateFeeFixed: number
      lateFeeInterest: number
      lateFeeDue: number
      lateFeeClaimedAt: string | null
      lateFeeWaived: boolean
      balanceDue: number
    }

    expect(res.status).toBe(200)
    expect(txMock.invoice.update).toHaveBeenCalledWith({
      where: { id: INVOICE_ID },
      data: {
        lateFeeWaived: true,
        lateFeeFixed: 0,
        lateFeeInterest: 0,
        lateFeeClaimedAt: null,
      },
    })
    expect(body.lateFeeFixed).toBe(0)
    expect(body.lateFeeInterest).toBe(0)
    expect(body.lateFeeDue).toBe(0)
    expect(body.lateFeeClaimedAt).toBeNull()
    expect(body.lateFeeWaived).toBe(true)
    expect(body.balanceDue).toBe(500)
  })

  it("returns 409 on a CANCELLED invoice", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-0001",
      clientId: "client-1",
      status: "CANCELLED",
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), routeParams)

    expect(res.status).toBe(409)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("refuses an invoice belonging to another userId", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null)

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), routeParams)

    expect(res.status).toBe(404)
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), routeParams)

    expect(res.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
