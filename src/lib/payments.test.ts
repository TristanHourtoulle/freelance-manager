import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (d: { toString(): string } | number | null | undefined) =>
    d == null ? null : Number(d),
}))

import { Prisma } from "@/generated/prisma/client"
import { getInvoiceComputed, recomputeInvoicePayment } from "./payments"

const NOW = new Date(2026, 5, 15, 12, 0, 0)
const PAST_DUE = new Date(2026, 4, 1)
const FUTURE_DUE = new Date(2026, 6, 1)

function euros(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

function payment(amount: string, paidAt = new Date(2026, 4, 20)) {
  return { amount: euros(amount), paidAt }
}

interface TxFixture {
  total: string
  lateFeeFixed?: string
  lateFeeInterest?: string
  lateFeeClaimedAt?: Date | null
  lateFeeWaived?: boolean
  paidSum: string
}

function makeTx(fixture: TxFixture): Prisma.TransactionClient {
  return {
    invoice: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        total: euros(fixture.total),
        lateFeeFixed: euros(fixture.lateFeeFixed ?? "0"),
        lateFeeInterest: euros(fixture.lateFeeInterest ?? "0"),
        lateFeeClaimedAt: fixture.lateFeeClaimedAt ?? null,
        lateFeeWaived: fixture.lateFeeWaived ?? false,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { amount: euros(fixture.paidSum) },
      }),
    },
  } as unknown as Prisma.TransactionClient
}

describe("getInvoiceComputed", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("is not overdue when the recomputed balance is settled despite a stale UNPAID status", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "UNPAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("1000")],
    })

    expect(computed.balanceDue).toBe(0)
    expect(computed.isOverdue).toBe(false)
  })

  it("is not overdue when a stale PARTIALLY_PAID status hides a full settlement", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("400"), payment("600")],
    })

    expect(computed.paidAmount).toBe(1000)
    expect(computed.isOverdue).toBe(false)
  })

  it("is overdue when past due with a positive balance", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("250")],
    })

    expect(computed.balanceDue).toBe(750)
    expect(computed.isOverdue).toBe(true)
  })

  it("is not overdue when overpaid", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "OVERPAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("1200")],
    })

    expect(computed.balanceDue).toBe(-200)
    expect(computed.isOverdue).toBe(false)
  })

  it("is not overdue when the due date is still ahead", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "UNPAID",
      dueDate: FUTURE_DUE,
      total: euros("1000"),
      payments: [],
    })

    expect(computed.isOverdue).toBe(false)
  })

  it("is not overdue on the exact due-date boundary", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "UNPAID",
      dueDate: NOW,
      total: euros("1000"),
      payments: [],
    })

    expect(computed.isOverdue).toBe(false)
  })

  it("is overdue one millisecond after the due date", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "UNPAID",
      dueDate: new Date(NOW.getTime() - 1),
      total: euros("1000"),
      payments: [],
    })

    expect(computed.isOverdue).toBe(true)
  })

  it("is never overdue for a draft or cancelled invoice", () => {
    for (const status of ["DRAFT", "CANCELLED"] as const) {
      const computed = getInvoiceComputed({
        status,
        paymentStatus: "UNPAID",
        dueDate: PAST_DUE,
        total: euros("1000"),
        payments: [],
      })

      expect(computed.isOverdue).toBe(false)
    }
  })

  it("reports the most recent payment date", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: FUTURE_DUE,
      total: euros("1000"),
      payments: [
        payment("100", new Date(2026, 3, 1)),
        payment("200", new Date(2026, 4, 9)),
        payment("50", new Date(2026, 2, 3)),
      ],
    })

    expect(computed.paidAmount).toBe(350)
    expect(computed.balanceDue).toBe(650)
    expect(computed.lastPaidAt).toBe(new Date(2026, 4, 9).toISOString())
  })

  it("returns a null lastPaidAt when there is no payment", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "UNPAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [],
    })

    expect(computed.lastPaidAt).toBeNull()
    expect(computed.isOverdue).toBe(true)
  })

  it("leaves balanceDue untouched while a late fee is only accruing, unclaimed", () => {
    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("400")],
    })

    expect(computed.balanceDue).toBe(600)
    expect(computed.lateFeeDue).toBe(0)
    expect(computed.lateFeeAccrued).toBeGreaterThan(0)
  })

  it("raises balanceDue by exactly the claimed late fee", () => {
    const baseline = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("400")],
    })

    const claimed = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("400")],
      lateFeeFixed: euros("40"),
      lateFeeInterest: euros("4.94"),
      lateFeeClaimedAt: new Date(2026, 4, 10),
    })

    expect(claimed.lateFeeDue).toBe(44.94)
    expect(claimed.balanceDue).toBe(baseline.balanceDue + 44.94)
    expect(claimed.balanceDue).toBe(644.94)
  })

  it("returns to the original behaviour once a claimed fee is waived", () => {
    const waived = getInvoiceComputed({
      status: "SENT",
      paymentStatus: "PARTIALLY_PAID",
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("400")],
      lateFeeFixed: euros("40"),
      lateFeeInterest: euros("4.94"),
      lateFeeClaimedAt: new Date(2026, 4, 10),
      lateFeeWaived: true,
    })

    expect(waived.lateFeeDue).toBe(0)
    expect(waived.balanceDue).toBe(600)
  })
})

describe("recomputeInvoicePayment", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("marks the real case PAID: total 5460 plus a claimed 44.94 penalty settled by 5504.94 in payments", async () => {
    const payments = [
      payment("1000", new Date(2026, 3, 25)),
      payment("1000", new Date(2026, 4, 5)),
      payment("2550", new Date(2026, 4, 15)),
      payment("629", new Date(2026, 4, 20)),
      payment("325.94", new Date(2026, 4, 25)),
    ]
    const tx = makeTx({
      total: "5460",
      lateFeeFixed: "40",
      lateFeeInterest: "4.94",
      lateFeeClaimedAt: new Date(2026, 4, 1),
      paidSum: "5504.94",
    })

    const paymentStatus = await recomputeInvoicePayment("inv-1", tx)
    expect(paymentStatus).toBe("PAID")

    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus,
      dueDate: PAST_DUE,
      total: euros("5460"),
      payments,
      lateFeeFixed: euros("40"),
      lateFeeInterest: euros("4.94"),
      lateFeeClaimedAt: new Date(2026, 4, 1),
    })

    expect(computed.balanceDue).toBe(0)
    expect(computed.isOverdue).toBe(false)
  })

  it("still flags a genuine overpayment beyond total plus the claimed penalty", async () => {
    const tx = makeTx({
      total: "1000",
      lateFeeFixed: "40",
      lateFeeInterest: "4.94",
      lateFeeClaimedAt: new Date(2026, 4, 1),
      paidSum: "1100",
    })

    const paymentStatus = await recomputeInvoicePayment("inv-2", tx)
    expect(paymentStatus).toBe("OVERPAID")

    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus,
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("1100")],
      lateFeeFixed: euros("40"),
      lateFeeInterest: euros("4.94"),
      lateFeeClaimedAt: new Date(2026, 4, 1),
    })

    expect(computed.balanceDue).toBeCloseTo(-55.06, 8)
  })

  it("stays PARTIALLY_PAID and overdue when the principal is settled but the claimed penalty is not", async () => {
    const tx = makeTx({
      total: "1000",
      lateFeeFixed: "40",
      lateFeeInterest: "4.94",
      lateFeeClaimedAt: new Date(2026, 4, 1),
      paidSum: "1000",
    })

    const paymentStatus = await recomputeInvoicePayment("inv-3", tx)
    expect(paymentStatus).toBe("PARTIALLY_PAID")

    const computed = getInvoiceComputed({
      status: "SENT",
      paymentStatus,
      dueDate: PAST_DUE,
      total: euros("1000"),
      payments: [payment("1000")],
      lateFeeFixed: euros("40"),
      lateFeeInterest: euros("4.94"),
      lateFeeClaimedAt: new Date(2026, 4, 1),
    })

    expect(computed.balanceDue).toBe(44.94)
    expect(computed.isOverdue).toBe(true)
  })
})
