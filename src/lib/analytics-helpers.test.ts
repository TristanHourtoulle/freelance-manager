import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/linear-service", () => ({
  fetchLinearIssues: vi.fn(),
}))

vi.mock("@/lib/billing", () => ({
  calculateBilling: vi.fn(),
}))

import { buildUtilizationByMonth } from "./analytics-helpers"

describe("buildUtilizationByMonth", () => {
  const monthRange = [
    { month: "2026-01", label: "Jan" },
    { month: "2026-02", label: "Feb" },
    { month: "2026-03", label: "Mar" },
  ]

  it("returns 0% rate when no hours are billed", () => {
    const result = buildUtilizationByMonth(monthRange, new Map(), 140)

    expect(result).toHaveLength(3)
    for (const entry of result) {
      expect(entry.billedHours).toBe(0)
      expect(entry.availableHours).toBe(140)
      expect(entry.rate).toBe(0)
    }
  })

  it("calculates correct utilization rates", () => {
    const monthHours = new Map([
      ["2026-01", 112],
      ["2026-02", 70],
      ["2026-03", 140],
    ])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.billedHours).toBe(112)
    expect(result[0]!.rate).toBe(80)
    expect(result[1]!.billedHours).toBe(70)
    expect(result[1]!.rate).toBe(50)
    expect(result[2]!.billedHours).toBe(140)
    expect(result[2]!.rate).toBe(100)
  })

  it("handles utilization above 100%", () => {
    const monthHours = new Map([["2026-01", 168]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.rate).toBe(120)
    expect(result[0]!.billedHours).toBe(168)
  })

  it("handles 0 available hours without crashing", () => {
    const monthHours = new Map([["2026-01", 50]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 0)

    expect(result[0]!.rate).toBe(0)
    expect(result[0]!.billedHours).toBe(50)
  })

  it("rounds billed hours to 2 decimal places", () => {
    const monthHours = new Map([["2026-01", 33.333]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.billedHours).toBe(33.33)
  })

  it("preserves month labels from input", () => {
    const result = buildUtilizationByMonth(monthRange, new Map(), 140)

    expect(result[0]!.month).toBe("2026-01")
    expect(result[0]!.label).toBe("Jan")
    expect(result[2]!.month).toBe("2026-03")
    expect(result[2]!.label).toBe("Mar")
  })
})
