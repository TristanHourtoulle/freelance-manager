import { describe, it, expect } from "vitest"
import {
  billingFilterSchema,
  markInvoicedSchema,
  historyFilterSchema,
} from "./billing"

describe("billingFilterSchema", () => {
  it("applies defaults for empty input", () => {
    const result = billingFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it("accepts valid clientId", () => {
    const result = billingFilterSchema.safeParse({ clientId: "client-1" })
    expect(result.success).toBe(true)
  })

  it("coerces string numbers for page and limit", () => {
    const result = billingFilterSchema.safeParse({ page: "3", limit: "50" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })

  it("rejects limit above 100", () => {
    expect(billingFilterSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it("rejects zero page", () => {
    expect(billingFilterSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it("rejects negative page", () => {
    expect(billingFilterSchema.safeParse({ page: -1 }).success).toBe(false)
  })

  it("coerces date strings for dateFrom and dateTo", () => {
    const result = billingFilterSchema.safeParse({
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dateFrom).toBeInstanceOf(Date)
      expect(result.data.dateTo).toBeInstanceOf(Date)
    }
  })

  it("accepts valid category filter (comma-separated)", () => {
    const result = billingFilterSchema.safeParse({
      category: "FREELANCE,STUDY",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toEqual(["FREELANCE", "STUDY"])
    }
  })

  it("rejects invalid category value", () => {
    expect(billingFilterSchema.safeParse({ category: "INVALID" }).success).toBe(
      false,
    )
  })
})

describe("markInvoicedSchema", () => {
  it("accepts array with one issue ID", () => {
    const result = markInvoicedSchema.safeParse({
      linearIssueIds: ["issue-1"],
    })
    expect(result.success).toBe(true)
  })

  it("accepts array with multiple issue IDs", () => {
    const result = markInvoicedSchema.safeParse({
      linearIssueIds: ["issue-1", "issue-2", "issue-3"],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.linearIssueIds).toHaveLength(3)
    }
  })

  it("rejects empty array", () => {
    expect(markInvoicedSchema.safeParse({ linearIssueIds: [] }).success).toBe(
      false,
    )
  })

  it("rejects missing field", () => {
    expect(markInvoicedSchema.safeParse({}).success).toBe(false)
  })

  it("rejects array with empty string", () => {
    expect(markInvoicedSchema.safeParse({ linearIssueIds: [""] }).success).toBe(
      false,
    )
  })
})

describe("historyFilterSchema", () => {
  it("accepts empty object", () => {
    const result = historyFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({})
    }
  })

  it("accepts clientId only", () => {
    const result = historyFilterSchema.safeParse({ clientId: "client-1" })
    expect(result.success).toBe(true)
  })

  it("coerces date strings", () => {
    const result = historyFilterSchema.safeParse({
      dateFrom: "2025-06-01",
      dateTo: "2025-12-31",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dateFrom).toBeInstanceOf(Date)
      expect(result.data.dateTo).toBeInstanceOf(Date)
    }
  })
})
