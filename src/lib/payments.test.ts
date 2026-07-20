import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (d: { toString(): string } | number | null | undefined) =>
    d == null ? null : Number(d),
}))

import { Prisma } from "@/generated/prisma/client"
import { getInvoiceComputed } from "./payments"

const NOW = new Date(2026, 5, 15, 12, 0, 0)
const PAST_DUE = new Date(2026, 4, 1)
const FUTURE_DUE = new Date(2026, 6, 1)

function euros(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

function payment(amount: string, paidAt = new Date(2026, 4, 20)) {
  return { amount: euros(amount), paidAt }
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
})
