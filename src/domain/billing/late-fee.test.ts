import { describe, expect, it } from "vitest"

import { computeLateFee, type LateFeeInput } from "./late-fee"

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function baseInput(overrides: Partial<LateFeeInput> = {}): LateFeeInput {
  return {
    total: 5460,
    dueDate: d("2026-08-14"),
    status: "SENT",
    payments: [],
    fixedAmount: 40,
    annualRate: 0.1,
    asOf: d("2026-09-04"),
    ...overrides,
  }
}

describe("computeLateFee", () => {
  it("matches the anchor case exactly", () => {
    const breakdown = computeLateFee(
      baseInput({
        payments: [
          { amount: 1000, paidAt: d("2026-07-31") },
          { amount: 1000, paidAt: d("2026-08-21") },
          { amount: 2550, paidAt: d("2026-08-31") },
          { amount: 629, paidAt: d("2026-09-02") },
          { amount: 325.94, paidAt: d("2026-09-04") },
        ],
      }),
    )

    expect(breakdown.segments).toHaveLength(4)

    expect(breakdown.segments[0]?.days).toBe(7)
    expect(breakdown.segments[0]?.outstanding).toBe(4460)
    expect(breakdown.segments[0]?.interest).toBeCloseTo(8.553424657, 8)

    expect(breakdown.segments[1]?.days).toBe(10)
    expect(breakdown.segments[1]?.outstanding).toBe(3460)
    expect(breakdown.segments[1]?.interest).toBeCloseTo(9.479452055, 8)

    expect(breakdown.segments[2]?.days).toBe(2)
    expect(breakdown.segments[2]?.outstanding).toBe(910)
    expect(breakdown.segments[2]?.interest).toBeCloseTo(0.498630137, 8)

    expect(breakdown.segments[3]?.days).toBe(2)
    expect(breakdown.segments[3]?.outstanding).toBe(281)
    expect(breakdown.segments[3]?.interest).toBeCloseTo(0.153972603, 8)

    expect(breakdown.daysLate).toBe(21)
    expect(breakdown.interest).toBe(18.69)
    expect(breakdown.fixed).toBe(40)
    expect(breakdown.total).toBe(58.69)
  })

  it("returns zero when the invoice is not yet due", () => {
    const breakdown = computeLateFee(
      baseInput({ asOf: d("2026-08-01"), payments: [] }),
    )

    expect(breakdown).toEqual({
      daysLate: 0,
      fixed: 0,
      interest: 0,
      total: 0,
      segments: [],
    })
  })

  it("accrues interest and the fixed fee when overdue and never paid", () => {
    const breakdown = computeLateFee(baseInput({ payments: [] }))

    expect(breakdown.daysLate).toBe(21)
    expect(breakdown.segments).toHaveLength(1)
    expect(breakdown.segments[0]?.days).toBe(21)
    expect(breakdown.segments[0]?.outstanding).toBe(5460)
    expect(breakdown.fixed).toBe(40)
    expect(breakdown.interest).toBeGreaterThan(0)
    expect(breakdown.total).toBe(breakdown.fixed + breakdown.interest)
  })

  it("returns zero when the invoice was settled at or before the due date", () => {
    const breakdown = computeLateFee(
      baseInput({
        payments: [{ amount: 5460, paidAt: d("2026-08-10") }],
      }),
    )

    expect(breakdown).toEqual({
      daysLate: 0,
      fixed: 0,
      interest: 0,
      total: 0,
      segments: [],
    })
  })

  it("stops accrual at settlement, not at asOf, when settled after the due date", () => {
    const breakdown = computeLateFee(
      baseInput({
        payments: [{ amount: 5460, paidAt: d("2026-08-19") }],
      }),
    )

    expect(breakdown.daysLate).toBe(5)
    expect(breakdown.segments).toHaveLength(1)
    expect(breakdown.segments[0]?.days).toBe(5)
    expect(breakdown.segments[0]?.outstanding).toBe(5460)
    expect(breakdown.fixed).toBe(40)
    expect(breakdown.interest).toBeGreaterThan(0)
  })

  it("returns zero for a DRAFT invoice", () => {
    const breakdown = computeLateFee(baseInput({ status: "DRAFT" }))

    expect(breakdown).toEqual({
      daysLate: 0,
      fixed: 0,
      interest: 0,
      total: 0,
      segments: [],
    })
  })

  it("returns zero for a CANCELLED invoice", () => {
    const breakdown = computeLateFee(baseInput({ status: "CANCELLED" }))

    expect(breakdown).toEqual({
      daysLate: 0,
      fixed: 0,
      interest: 0,
      total: 0,
      segments: [],
    })
  })

  it("returns zero when asOf equals the due date", () => {
    const breakdown = computeLateFee(baseInput({ asOf: d("2026-08-14") }))

    expect(breakdown).toEqual({
      daysLate: 0,
      fixed: 0,
      interest: 0,
      total: 0,
      segments: [],
    })
  })

  it("charges the fixed fee plus one day of interest the day after the due date", () => {
    const breakdown = computeLateFee(baseInput({ asOf: d("2026-08-15") }))

    expect(breakdown.daysLate).toBe(1)
    expect(breakdown.segments).toHaveLength(1)
    expect(breakdown.segments[0]?.days).toBe(1)
    expect(breakdown.fixed).toBe(40)
    const expectedInterest = round2((5460 * 0.1 * 1) / 365)
    expect(breakdown.interest).toBe(expectedInterest)
    expect(breakdown.total).toBe(round2(40 + (5460 * 0.1 * 1) / 365))
  })

  it("charges only the fixed fee when the annual rate is zero", () => {
    const breakdown = computeLateFee(baseInput({ annualRate: 0, payments: [] }))

    expect(breakdown.daysLate).toBe(21)
    expect(breakdown.interest).toBe(0)
    expect(breakdown.fixed).toBe(40)
    expect(breakdown.total).toBe(40)
  })

  it("never goes negative and stops accrual when payments overshoot the total", () => {
    const breakdown = computeLateFee(
      baseInput({
        total: 1000,
        payments: [{ amount: 1500, paidAt: d("2026-08-19") }],
      }),
    )

    expect(breakdown.daysLate).toBe(5)
    expect(breakdown.segments).toHaveLength(1)
    expect(breakdown.segments[0]?.outstanding).toBe(1000)
    expect(breakdown.interest).toBeGreaterThan(0)
    expect(breakdown.fixed).toBe(40)
    expect(breakdown.total).toBeGreaterThan(0)
  })
})

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
