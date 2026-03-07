import { describe, it, expect } from "vitest"
import {
  createTaskOverrideSchema,
  updateTaskOverrideSchema,
} from "./task-override"

describe("createTaskOverrideSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = createTaskOverrideSchema.safeParse({
      clientId: "client-123",
      linearIssueId: "ACME-101",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.toInvoice).toBe(false)
      expect(result.data.invoiced).toBe(false)
    }
  })

  it("accepts full valid input", () => {
    const result = createTaskOverrideSchema.safeParse({
      clientId: "client-123",
      linearIssueId: "ACME-101",
      toInvoice: true,
      invoiced: true,
      invoicedAt: "2026-02-28",
      rateOverride: 90,
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing clientId", () => {
    const result = createTaskOverrideSchema.safeParse({
      linearIssueId: "ACME-101",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing linearIssueId", () => {
    const result = createTaskOverrideSchema.safeParse({
      clientId: "client-123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative rateOverride", () => {
    const result = createTaskOverrideSchema.safeParse({
      clientId: "client-123",
      linearIssueId: "ACME-101",
      rateOverride: -10,
    })
    expect(result.success).toBe(false)
  })
})

describe("updateTaskOverrideSchema", () => {
  it("accepts empty object", () => {
    const result = updateTaskOverrideSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts null rateOverride (clearing override)", () => {
    const result = updateTaskOverrideSchema.safeParse({ rateOverride: null })
    expect(result.success).toBe(true)
  })

  it("rejects negative rateOverride", () => {
    const result = updateTaskOverrideSchema.safeParse({ rateOverride: -5 })
    expect(result.success).toBe(false)
  })
})
