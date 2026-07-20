import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (
    d: { toNumber?: () => number } | number | null | undefined,
  ) =>
    d == null ? null : typeof d === "number" ? d : (d.toNumber?.() ?? null),
}))

import {
  accuracyByKey,
  computeEstimateAccuracy,
  ESTIMATE_ACCURACY_MIN_SAMPLE,
  type AccuracyTaskRow,
} from "./estimate-accuracy"

/**
 * Minimal stand-in for a Prisma Decimal: the aggregation only ever calls
 * `toNumber()` through `decimalToNumber`.
 */
function decimal(value: number) {
  return { toNumber: () => value } as unknown as AccuracyTaskRow["estimate"]
}

function task(
  estimate: AccuracyTaskRow["estimate"],
  actualDays: AccuracyTaskRow["actualDays"],
  clientId = "c1",
): AccuracyTaskRow {
  return { clientId, estimate, actualDays }
}

describe("computeEstimateAccuracy", () => {
  it("divides the summed actual days by the summed estimates", () => {
    const result = computeEstimateAccuracy([task(2, 3), task(3, 3)])

    expect(result.ratio).toBe(1.2)
    expect(result.n).toBe(2)
    expect(result.sumEstimate).toBe(5)
    expect(result.sumActual).toBe(6)
  })

  it("excludes unmeasured rows from the sums but keeps them in the coverage", () => {
    const result = computeEstimateAccuracy([
      task(2, 3),
      task(3, 3),
      task(4, null),
      task(1, null),
      task(5, null),
    ])

    expect(result.n).toBe(2)
    expect(result.coverage).toBe(0.4)
    expect(result.sumEstimate).toBe(5)
  })

  it("excludes rows without an estimate", () => {
    const result = computeEstimateAccuracy([task(null, 4), task(2, 2)])

    expect(result.n).toBe(1)
    expect(result.ratio).toBe(1)
  })

  it("excludes a zero estimate, which is not a real estimate", () => {
    const result = computeEstimateAccuracy([task(0, 4), task(2, 2)])

    expect(result.n).toBe(1)
    expect(result.sumEstimate).toBe(2)
  })

  it("counts a zero actualDays as a real measurement", () => {
    const result = computeEstimateAccuracy([task(2, 0), task(2, 2)])

    expect(result.n).toBe(2)
    expect(result.ratio).toBe(0.5)
  })

  it("returns null rather than NaN or Infinity when nothing qualifies", () => {
    const result = computeEstimateAccuracy([task(null, null), task(0, 1)])

    expect(result.ratio).toBeNull()
    expect(result.n).toBe(0)
    expect(result.reliable).toBe(false)
    expect(Number.isNaN(result.ratio as unknown as number)).toBe(false)
    expect(result.ratio).not.toBe(Number.POSITIVE_INFINITY)
  })

  it("returns a null coverage for empty input", () => {
    const result = computeEstimateAccuracy([])

    expect(result.coverage).toBeNull()
    expect(result.ratio).toBeNull()
    expect(result.n).toBe(0)
  })

  it("gates reliability on the minimum sample size", () => {
    const three = computeEstimateAccuracy([task(1, 1), task(1, 1), task(1, 1)])
    expect(three.n).toBe(3)
    expect(three.reliable).toBe(false)

    const exact = computeEstimateAccuracy(
      Array.from({ length: ESTIMATE_ACCURACY_MIN_SAMPLE }, () => task(1, 1)),
    )
    expect(exact.n).toBe(ESTIMATE_ACCURACY_MIN_SAMPLE)
    expect(exact.reliable).toBe(true)
  })

  it("unwraps Prisma Decimal values", () => {
    const result = computeEstimateAccuracy([task(decimal(1.5), decimal(3))])

    expect(result.sumEstimate).toBe(1.5)
    expect(result.sumActual).toBe(3)
    expect(result.ratio).toBe(2)
  })

  it("ignores non-finite effort values", () => {
    const result = computeEstimateAccuracy([
      task(Number.POSITIVE_INFINITY, 2),
      task(2, Number.NaN),
      task(2, 4),
    ])

    expect(result.n).toBe(1)
    expect(result.ratio).toBe(2)
  })
})

describe("accuracyByKey", () => {
  it("keeps groups isolated and reports each ratio separately", () => {
    const result = accuracyByKey([
      { ...task(2, 4), key: "a" as const },
      { ...task(2, 4), key: "a" as const },
      { ...task(4, 2), key: "b" as const },
    ])

    expect(result.a?.ratio).toBe(2)
    expect(result.a?.n).toBe(2)
    expect(result.b?.ratio).toBe(0.5)
    expect(result.b?.n).toBe(1)
  })

  it("reports a null ratio for a group with no qualifying rows", () => {
    const result = accuracyByKey([
      { ...task(null, null), key: "a" as const },
      { ...task(2, 2), key: "b" as const },
    ])

    expect(result.a).toMatchObject({ ratio: null, n: 0, reliable: false })
    expect(result.b?.ratio).toBe(1)
  })

  it("returns an empty record for empty input", () => {
    expect(accuracyByKey([])).toEqual({})
  })
})
