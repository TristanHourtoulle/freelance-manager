import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (
    d: { toNumber?: () => number } | number | null | undefined,
  ) =>
    d == null ? null : typeof d === "number" ? d : (d.toNumber?.() ?? null),
}))

import {
  aggregateDaysByClient,
  computeEffectiveRate,
  effortDaysForTask,
  withEffectiveRates,
  type EffortTaskRow,
} from "./effective-rate"

/**
 * Minimal stand-in for a Prisma Decimal: the only contract the aggregation
 * relies on is `toNumber()`, which `decimalToNumber` calls.
 */
function decimal(value: number) {
  return { toNumber: () => value } as unknown as EffortTaskRow["estimate"]
}

describe("effortDaysForTask", () => {
  it("prefers actualDays over the Linear estimate", () => {
    expect(effortDaysForTask({ estimate: 3, actualDays: 5 })).toBe(5)
  })

  it("treats an explicit 0 actualDays as a measurement, not as missing", () => {
    expect(effortDaysForTask({ estimate: 4, actualDays: 0 })).toBe(0)
  })

  it("falls back to the estimate when actualDays is null", () => {
    expect(effortDaysForTask({ estimate: 2, actualDays: null })).toBe(2)
  })

  it("returns null when both fields are missing", () => {
    expect(effortDaysForTask({ estimate: null, actualDays: null })).toBeNull()
  })

  it("returns null for non-finite effort", () => {
    expect(
      effortDaysForTask({ estimate: null, actualDays: Number.NaN }),
    ).toBeNull()
    expect(
      effortDaysForTask({
        estimate: Number.POSITIVE_INFINITY,
        actualDays: null,
      }),
    ).toBeNull()
  })

  it("unwraps Prisma Decimal values", () => {
    expect(
      effortDaysForTask({ estimate: decimal(1.5), actualDays: null }),
    ).toBe(1.5)
    expect(
      effortDaysForTask({ estimate: decimal(1.5), actualDays: decimal(0) }),
    ).toBe(0)
  })
})

describe("aggregateDaysByClient", () => {
  it("sums mixed estimate and actual effort per client", () => {
    const rows: EffortTaskRow[] = [
      { clientId: "c1", estimate: 2, actualDays: 3 },
      { clientId: "c1", estimate: decimal(1.5), actualDays: null },
      { clientId: "c2", estimate: 10, actualDays: 0 },
      { clientId: "c3", estimate: null, actualDays: null },
    ]

    const days = aggregateDaysByClient(rows)

    expect(days.get("c1")).toBe(4.5)
    expect(days.get("c2")).toBe(0)
    expect(days.has("c3")).toBe(false)
  })

  it("returns an empty map for no rows", () => {
    expect(aggregateDaysByClient([]).size).toBe(0)
  })
})

describe("computeEffectiveRate", () => {
  it("divides revenue by days", () => {
    expect(computeEffectiveRate(5000, 10)).toBe(500)
  })

  it("rounds to the nearest euro", () => {
    expect(computeEffectiveRate(1000, 3)).toBe(333)
  })

  it("returns null on zero days instead of Infinity", () => {
    expect(computeEffectiveRate(5000, 0)).toBeNull()
  })

  it("returns null on negative days", () => {
    expect(computeEffectiveRate(5000, -2)).toBeNull()
  })

  it("returns null on 0/0 instead of NaN", () => {
    expect(computeEffectiveRate(0, 0)).toBeNull()
  })

  it("returns null on non-finite inputs", () => {
    expect(computeEffectiveRate(Number.NaN, 5)).toBeNull()
    expect(computeEffectiveRate(5000, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe("withEffectiveRates", () => {
  it("attaches days and the rate, preserving input order", () => {
    const rows = withEffectiveRates(
      [
        { clientId: "c1", revenue: 9000 },
        { clientId: "c2", revenue: 4000 },
        { clientId: "c3", revenue: 1000 },
      ],
      [
        { clientId: "c1", estimate: 5, actualDays: 10 },
        { clientId: "c1", estimate: 5, actualDays: null },
        { clientId: "c2", estimate: 8, actualDays: 0 },
      ],
    )

    expect(rows).toEqual([
      { clientId: "c1", revenue: 9000, days: 15, effectiveRate: 600 },
      { clientId: "c2", revenue: 4000, days: 0, effectiveRate: null },
      { clientId: "c3", revenue: 1000, days: 0, effectiveRate: null },
    ])
  })
})
