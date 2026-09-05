import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    payment: { findUnique: vi.fn() },
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

const recomputeInvoicePayment = vi.fn()
vi.mock("@/lib/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payments")>()
  return {
    ...actual,
    recomputeInvoicePayment: (...args: unknown[]) =>
      recomputeInvoicePayment(...args),
  }
})
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("@/lib/data/invoices", () => ({
  invoicesTag: (id: string) => `user-${id}-invoices`,
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const INVOICE_ID = "inv-1"
const PAYMENT_ID = "pay-1"

const routeParams = {
  params: Promise.resolve({ id: INVOICE_ID, paymentId: PAYMENT_ID }),
}

function patchRequest(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/invoices/${INVOICE_ID}/payments/${PAYMENT_ID}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  )
}

describe("PATCH /api/invoices/[id]/payments/[paymentId] — penalty invariant", () => {
  const tx = { payment: { update: vi.fn() } }

  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.payment.findUnique.mockResolvedValue({
      id: PAYMENT_ID,
      invoiceId: INVOICE_ID,
      userId: "user-1",
      penaltyAmount: 44.94,
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    )
    tx.payment.update.mockResolvedValue({
      id: PAYMENT_ID,
      amount: 100,
      paidAt: new Date("2026-08-01"),
      method: null,
      note: null,
      createdAt: new Date("2026-08-01"),
      penaltyAmount: 44.94,
    })
    recomputeInvoicePayment.mockResolvedValue("PAID")
  })

  it("rejects lowering the amount below the payment's own frozen penaltyAmount", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ amount: 30 }), routeParams)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe(
      "La pénalité ne peut pas dépasser le montant du paiement",
    )
    expect(tx.payment.update).not.toHaveBeenCalled()
  })

  it("allows an amount update that still covers the frozen penalty", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ amount: 100 }), routeParams)

    expect(res.status).toBe(200)
    expect(tx.payment.update).toHaveBeenCalledTimes(1)
  })

  it("skips the penalty check when the amount is not part of the update", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ note: "Virement" }), routeParams)

    expect(res.status).toBe(200)
    expect(tx.payment.update).toHaveBeenCalledTimes(1)
  })

  it("returns not found for a payment belonging to another user", async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null)
    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ amount: 100 }), routeParams)

    expect(res.status).toBe(404)
  })
})
