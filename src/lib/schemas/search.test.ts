import { describe, it, expect } from "vitest"
import { searchQuerySchema } from "./search"

describe("searchQuerySchema", () => {
  it("accepts valid query string", () => {
    const result = searchQuerySchema.safeParse({ q: "dashboard" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.q).toBe("dashboard")
    }
  })

  it("rejects empty query", () => {
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false)
  })

  it("rejects missing q field", () => {
    expect(searchQuerySchema.safeParse({}).success).toBe(false)
  })

  it("rejects query exceeding 100 characters", () => {
    expect(searchQuerySchema.safeParse({ q: "a".repeat(101) }).success).toBe(
      false,
    )
  })

  it("accepts query at max length (100)", () => {
    const result = searchQuerySchema.safeParse({ q: "a".repeat(100) })
    expect(result.success).toBe(true)
  })

  it("accepts single character query", () => {
    const result = searchQuerySchema.safeParse({ q: "x" })
    expect(result.success).toBe(true)
  })
})
