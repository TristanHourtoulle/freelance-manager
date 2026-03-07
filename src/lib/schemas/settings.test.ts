import { describe, it, expect } from "vitest"
import { updateSettingsSchema } from "./settings"

describe("updateSettingsSchema", () => {
  it("accepts valid available hours", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 140,
    })
    expect(result.success).toBe(true)
  })

  it("accepts minimum value of 1", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 1,
    })
    expect(result.success).toBe(true)
  })

  it("accepts maximum value of 744", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 744,
    })
    expect(result.success).toBe(true)
  })

  it("rejects 0", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative values", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: -10,
    })
    expect(result.success).toBe(false)
  })

  it("rejects values above 744", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 745,
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-integer values", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: 140.5,
    })
    expect(result.success).toBe(false)
  })

  it("rejects string values", () => {
    const result = updateSettingsSchema.safeParse({
      availableHoursPerMonth: "140",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing field", () => {
    const result = updateSettingsSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
