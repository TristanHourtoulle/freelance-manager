import { describe, it, expect } from "vitest"
import {
  calculateBilling,
  calculateGroupTotal,
  calculateFixedGroupTotal,
} from "./billing"

describe("calculateBilling", () => {
  describe("HOURLY mode", () => {
    it("calculates estimate x rate", () => {
      const result = calculateBilling({
        billingMode: "HOURLY",
        rate: 75,
        estimate: 2,
      })
      expect(result.amount).toBe(150)
      expect(result.formula).toBe("2h x 75 EUR/h")
    })

    it("returns 0 when no estimate", () => {
      const result = calculateBilling({
        billingMode: "HOURLY",
        rate: 75,
        estimate: undefined,
      })
      expect(result.amount).toBe(0)
      expect(result.formula).toBe("No estimate")
    })

    it("returns 0 when estimate is 0", () => {
      const result = calculateBilling({
        billingMode: "HOURLY",
        rate: 75,
        estimate: 0,
      })
      expect(result.amount).toBe(0)
    })

    it("uses rateOverride when provided", () => {
      const result = calculateBilling({
        billingMode: "HOURLY",
        rate: 75,
        estimate: 2,
        rateOverride: 100,
      })
      expect(result.amount).toBe(200)
      expect(result.formula).toBe("2h x 100 EUR/h")
    })
  })

  describe("DAILY mode", () => {
    it("calculates (estimate / 8) x rate", () => {
      const result = calculateBilling({
        billingMode: "DAILY",
        rate: 600,
        estimate: 8,
      })
      expect(result.amount).toBe(600)
      expect(result.formula).toBe("1.00d x 600 EUR/d")
    })

    it("handles fractional days", () => {
      const result = calculateBilling({
        billingMode: "DAILY",
        rate: 600,
        estimate: 4,
      })
      expect(result.amount).toBe(300)
      expect(result.formula).toBe("0.50d x 600 EUR/d")
    })

    it("returns 0 when no estimate", () => {
      const result = calculateBilling({
        billingMode: "DAILY",
        rate: 600,
        estimate: undefined,
      })
      expect(result.amount).toBe(0)
    })
  })

  describe("FIXED mode", () => {
    it("returns 0 per task", () => {
      const result = calculateBilling({
        billingMode: "FIXED",
        rate: 5000,
        estimate: 10,
      })
      expect(result.amount).toBe(0)
      expect(result.formula).toBe("Fixed project rate")
    })
  })

  describe("FREE mode", () => {
    it("always returns 0", () => {
      const result = calculateBilling({
        billingMode: "FREE",
        rate: 100,
        estimate: 10,
      })
      expect(result.amount).toBe(0)
      expect(result.formula).toBe("Free")
    })
  })

  it("rounds to 2 decimal places", () => {
    const result = calculateBilling({
      billingMode: "HOURLY",
      rate: 33.33,
      estimate: 3,
    })
    expect(result.amount).toBe(99.99)
  })
})

describe("calculateGroupTotal", () => {
  it("sums billing amounts for toInvoice tasks only", () => {
    const tasks = [
      { billingAmount: 100, toInvoice: true },
      { billingAmount: 200, toInvoice: false },
      { billingAmount: 150, toInvoice: true },
    ]
    expect(calculateGroupTotal(tasks)).toBe(250)
  })

  it("returns 0 for empty array", () => {
    expect(calculateGroupTotal([])).toBe(0)
  })
})

describe("calculateFixedGroupTotal", () => {
  it("returns rate when there are toInvoice tasks", () => {
    expect(calculateFixedGroupTotal(5000, true)).toBe(5000)
  })

  it("returns 0 when no toInvoice tasks", () => {
    expect(calculateFixedGroupTotal(5000, false)).toBe(0)
  })
})
