import { describe, it, expect } from "vitest"
import { createInvoiceSchema, updateInvoiceSchema } from "./invoice"

describe("createInvoiceSchema", () => {
  it("accepts valid input with ISO date string", () => {
    const result = createInvoiceSchema.safeParse({
      clientId: "client-123",
      month: "2026-02-01",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.month).toBeInstanceOf(Date)
      expect(result.data.totalAmount).toBe(0)
      expect(result.data.status).toBe("DRAFT")
    }
  })

  it("accepts Date object for month", () => {
    const result = createInvoiceSchema.safeParse({
      clientId: "client-123",
      month: new Date("2026-03-01"),
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing clientId", () => {
    const result = createInvoiceSchema.safeParse({
      month: "2026-02-01",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty clientId", () => {
    const result = createInvoiceSchema.safeParse({
      clientId: "",
      month: "2026-02-01",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative totalAmount", () => {
    const result = createInvoiceSchema.safeParse({
      clientId: "client-123",
      month: "2026-02-01",
      totalAmount: -100,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid status", () => {
    const result = createInvoiceSchema.safeParse({
      clientId: "client-123",
      month: "2026-02-01",
      status: "CANCELLED",
    })
    expect(result.success).toBe(false)
  })
})

describe("updateInvoiceSchema", () => {
  it("accepts empty object", () => {
    const result = updateInvoiceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts valid partial update", () => {
    const result = updateInvoiceSchema.safeParse({
      status: "PAID",
      totalAmount: 3500,
    })
    expect(result.success).toBe(true)
  })

  it("rejects negative totalAmount", () => {
    const result = updateInvoiceSchema.safeParse({ totalAmount: -1 })
    expect(result.success).toBe(false)
  })
})
