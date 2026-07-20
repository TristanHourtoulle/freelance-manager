import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (
    d: { toNumber?: () => number } | number | null | undefined,
  ) =>
    d == null ? null : typeof d === "number" ? d : (d.toNumber?.() ?? null),
}))

import {
  businessDaysUntil,
  clampWorkingDaysPerWeek,
  deriveAtRisk,
  formatWorkloadCoverage,
  formatWorkloadDays,
  summarizeWorkload,
  type OpenTaskEffortRow,
} from "./workload"

/**
 * Minimal stand-in for a Prisma Decimal: the only contract the summarization
 * relies on is `toNumber()`, which `decimalToNumber` calls.
 */
function decimal(value: number): OpenTaskEffortRow["estimate"] {
  return { toNumber: () => value } as unknown as OpenTaskEffortRow["estimate"]
}

describe("summarizeWorkload", () => {
  it("returns zeroes for an empty list", () => {
    expect(summarizeWorkload([])).toEqual({
      days: 0,
      taskCount: 0,
      estimatedTaskCount: 0,
      missingEstimateCount: 0,
    })
  })

  it("sums estimates and counts the rows without one", () => {
    const result = summarizeWorkload([
      { estimate: 3 },
      { estimate: null },
      { estimate: 2 },
      { estimate: null },
    ])

    expect(result).toEqual({
      days: 5,
      taskCount: 4,
      estimatedTaskCount: 2,
      missingEstimateCount: 2,
    })
  })

  it("counts an estimate of exactly zero as estimated", () => {
    const result = summarizeWorkload([{ estimate: 0 }])

    expect(result.days).toBe(0)
    expect(result.estimatedTaskCount).toBe(1)
    expect(result.missingEstimateCount).toBe(0)
  })

  it("treats non-finite estimates as missing instead of poisoning the sum", () => {
    const result = summarizeWorkload([
      { estimate: Number.NaN },
      { estimate: Number.POSITIVE_INFINITY },
      { estimate: 4 },
    ])

    expect(Number.isFinite(result.days)).toBe(true)
    expect(result.days).toBe(4)
    expect(result.missingEstimateCount).toBe(2)
  })

  it("unwraps Prisma Decimal estimates", () => {
    const result = summarizeWorkload([
      { estimate: decimal(1.5) },
      { estimate: decimal(2.5) },
    ])

    expect(result.days).toBe(4)
    expect(result.estimatedTaskCount).toBe(2)
  })

  it("sums fractional estimates", () => {
    expect(summarizeWorkload([{ estimate: 0.5 }, { estimate: 0.5 }]).days).toBe(
      1,
    )
  })
})

describe("clampWorkingDaysPerWeek", () => {
  it("falls back to the default for absent or invalid values", () => {
    expect(clampWorkingDaysPerWeek(null)).toBe(5)
    expect(clampWorkingDaysPerWeek(undefined)).toBe(5)
    expect(clampWorkingDaysPerWeek(Number.NaN)).toBe(5)
  })

  it("clamps and rounds into the supported range", () => {
    expect(clampWorkingDaysPerWeek(0)).toBe(1)
    expect(clampWorkingDaysPerWeek(9)).toBe(7)
    expect(clampWorkingDaysPerWeek(4.4)).toBe(4)
    expect(clampWorkingDaysPerWeek(4.6)).toBe(5)
  })
})

describe("businessDaysUntil", () => {
  const now = new Date("2026-07-20T00:00:00.000Z")

  it("returns 0 for a target in the past", () => {
    expect(
      businessDaysUntil(new Date("2026-07-10T00:00:00.000Z"), now, 5),
    ).toBe(0)
  })

  it("returns 0 when the target is today", () => {
    expect(businessDaysUntil(now, now, 5)).toBe(0)
  })

  it("scales the calendar span by the weekly capacity", () => {
    expect(
      businessDaysUntil(new Date("2026-07-27T00:00:00.000Z"), now, 5),
    ).toBe(5)
    expect(
      businessDaysUntil(new Date("2026-07-27T00:00:00.000Z"), now, 7),
    ).toBe(7)
    expect(
      businessDaysUntil(new Date("2026-07-23T00:00:00.000Z"), now, 5),
    ).toBe(2)
  })

  it("ignores the time of day within the same UTC day", () => {
    expect(
      businessDaysUntil(
        new Date("2026-07-27T00:00:00.000Z"),
        new Date("2026-07-20T23:00:00.000Z"),
        5,
      ),
    ).toBe(5)
  })
})

describe("deriveAtRisk", () => {
  const now = new Date("2026-07-20T00:00:00.000Z")
  const targetIn7Days = new Date("2026-07-27T00:00:00.000Z")

  it("never fires on a project without a target date, however large the backlog", () => {
    expect(
      deriveAtRisk({
        remainingDays: 999,
        targetDate: null,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
  })

  it("returns false when there is no remaining work", () => {
    expect(
      deriveAtRisk({
        remainingDays: 0,
        targetDate: new Date("2026-07-01T00:00:00.000Z"),
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
  })

  it("flags a backlog larger than the working days left", () => {
    expect(
      deriveAtRisk({
        remainingDays: 10,
        targetDate: targetIn7Days,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(true)
  })

  it("does not flag a backlog that fits", () => {
    expect(
      deriveAtRisk({
        remainingDays: 3,
        targetDate: targetIn7Days,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
  })

  it("does not flag an exact fit", () => {
    expect(
      deriveAtRisk({
        remainingDays: 5,
        targetDate: targetIn7Days,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
  })

  it("flags remaining work past an elapsed target", () => {
    expect(
      deriveAtRisk({
        remainingDays: 1,
        targetDate: new Date("2026-07-01T00:00:00.000Z"),
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(true)
  })

  it("returns false for negative or non-finite remaining days", () => {
    expect(
      deriveAtRisk({
        remainingDays: -3,
        targetDate: targetIn7Days,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
    expect(
      deriveAtRisk({
        remainingDays: Number.NaN,
        targetDate: targetIn7Days,
        now,
        workingDaysPerWeek: 5,
      }),
    ).toBe(false)
  })
})

describe("formatWorkloadCoverage", () => {
  it("states when nothing is open", () => {
    expect(
      formatWorkloadCoverage({
        days: 0,
        taskCount: 0,
        estimatedTaskCount: 0,
        missingEstimateCount: 0,
      }),
    ).toBe("Aucune tâche ouverte")
  })

  it("states full coverage in the singular", () => {
    expect(
      formatWorkloadCoverage({
        days: 2,
        taskCount: 1,
        estimatedTaskCount: 1,
        missingEstimateCount: 0,
      }),
    ).toBe("1 tâche · toutes estimées")
  })

  it("states the number of tasks without an estimate", () => {
    expect(
      formatWorkloadCoverage({
        days: 18,
        taskCount: 24,
        estimatedTaskCount: 15,
        missingEstimateCount: 9,
      }),
    ).toBe("24 tâches · 9 sans estimation")
  })
})

describe("formatWorkloadDays", () => {
  it("formats day counts in French", () => {
    expect(formatWorkloadDays(18)).toBe("18 j")
    expect(formatWorkloadDays(0)).toBe("0 j")
    expect(formatWorkloadDays(17.5)).toBe("17,5 j")
  })
})
