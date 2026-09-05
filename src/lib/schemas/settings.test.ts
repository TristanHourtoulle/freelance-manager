import { describe, expect, it } from "vitest"
import {
  DEFAULT_LATE_FEE_ANNUAL_RATE,
  DEFAULT_LATE_FEE_FIXED_AMOUNT,
  settingsUpdateSchema,
} from "./settings"

describe("settingsUpdateSchema", () => {
  describe("lateFeeAnnualRate", () => {
    it("accepts a fraction like 0.1", () => {
      expect(settingsUpdateSchema.parse({ lateFeeAnnualRate: 0.1 })).toEqual({
        lateFeeAnnualRate: 0.1,
      })
    })

    it("rejects a raw percentage value like 10", () => {
      expect(
        settingsUpdateSchema.safeParse({ lateFeeAnnualRate: 10 }).success,
      ).toBe(false)
    })

    it("accepts the inclusive lower bound 0", () => {
      expect(settingsUpdateSchema.parse({ lateFeeAnnualRate: 0 })).toEqual({
        lateFeeAnnualRate: 0,
      })
    })

    it("accepts the inclusive upper bound 1", () => {
      expect(settingsUpdateSchema.parse({ lateFeeAnnualRate: 1 })).toEqual({
        lateFeeAnnualRate: 1,
      })
    })

    it("rejects a value just below the lower bound", () => {
      expect(
        settingsUpdateSchema.safeParse({ lateFeeAnnualRate: -0.01 }).success,
      ).toBe(false)
    })

    it("rejects a value just above the upper bound", () => {
      expect(
        settingsUpdateSchema.safeParse({ lateFeeAnnualRate: 1.01 }).success,
      ).toBe(false)
    })

    it("coerces a numeric string", () => {
      expect(settingsUpdateSchema.parse({ lateFeeAnnualRate: "0.1" })).toEqual({
        lateFeeAnnualRate: 0.1,
      })
    })
  })

  describe("lateFeeFixedAmount", () => {
    it("accepts a typical amount", () => {
      expect(settingsUpdateSchema.parse({ lateFeeFixedAmount: 40 })).toEqual({
        lateFeeFixedAmount: 40,
      })
    })

    it("accepts 0", () => {
      expect(settingsUpdateSchema.parse({ lateFeeFixedAmount: 0 })).toEqual({
        lateFeeFixedAmount: 0,
      })
    })

    it("rejects a negative amount", () => {
      expect(
        settingsUpdateSchema.safeParse({ lateFeeFixedAmount: -1 }).success,
      ).toBe(false)
    })

    it("accepts the inclusive upper bound 10_000", () => {
      expect(
        settingsUpdateSchema.parse({ lateFeeFixedAmount: 10_000 }),
      ).toEqual({ lateFeeFixedAmount: 10_000 })
    })

    it("rejects a value above the upper bound", () => {
      expect(
        settingsUpdateSchema.safeParse({ lateFeeFixedAmount: 10_001 }).success,
      ).toBe(false)
    })
  })

  it("parses successfully when both late-fee fields are omitted", () => {
    expect(settingsUpdateSchema.parse({})).toEqual({})
  })

  it("exposes the fallback late-fee defaults used by settings and MCP", () => {
    expect(DEFAULT_LATE_FEE_FIXED_AMOUNT).toBe(40)
    expect(DEFAULT_LATE_FEE_ANNUAL_RATE).toBe(0.1)
  })

  it("accepts a valid ISO currency code", () => {
    expect(settingsUpdateSchema.parse({ defaultCurrency: "EUR" })).toEqual({
      defaultCurrency: "EUR",
    })
  })

  it("rejects a currency code that is not 3 characters", () => {
    expect(
      settingsUpdateSchema.safeParse({ defaultCurrency: "EU" }).success,
    ).toBe(false)
  })

  it("coerces and bounds defaultPaymentDays as an integer between 0 and 180", () => {
    expect(settingsUpdateSchema.parse({ defaultPaymentDays: "30" })).toEqual({
      defaultPaymentDays: 30,
    })
    expect(
      settingsUpdateSchema.safeParse({ defaultPaymentDays: 181 }).success,
    ).toBe(false)
  })

  it("coerces and bounds defaultRate between 0 and 100_000", () => {
    expect(settingsUpdateSchema.parse({ defaultRate: "500" })).toEqual({
      defaultRate: 500,
    })
    expect(settingsUpdateSchema.safeParse({ defaultRate: -1 }).success).toBe(
      false,
    )
  })

  it("coerces and bounds workingDaysPerWeek as an integer between 1 and 7", () => {
    expect(
      settingsUpdateSchema.parse({ workingDaysPerWeek: "5" }),
    ).toEqual({ workingDaysPerWeek: 5 })
    expect(
      settingsUpdateSchema.safeParse({ workingDaysPerWeek: 8 }).success,
    ).toBe(false)
  })
})
