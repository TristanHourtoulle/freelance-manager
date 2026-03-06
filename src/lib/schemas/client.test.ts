import { describe, it, expect } from "vitest"
import {
  createClientSchema,
  updateClientSchema,
  clientFilterSchema,
} from "./client"

describe("createClientSchema", () => {
  it("accepts valid input with defaults", () => {
    const result = createClientSchema.safeParse({ name: "Acme Corp" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Acme Corp")
      expect(result.data.billingMode).toBe("HOURLY")
      expect(result.data.rate).toBe(0)
      expect(result.data.category).toBe("FREELANCE")
    }
  })

  it("accepts full valid input", () => {
    const result = createClientSchema.safeParse({
      name: "Acme Corp",
      email: "contact@acme.com",
      company: "Acme Inc.",
      billingMode: "DAILY",
      rate: 500,
      category: "SIDE_PROJECT",
      notes: "Some notes",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty name", () => {
    const result = createClientSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing name", () => {
    const result = createClientSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects name exceeding 100 characters", () => {
    const result = createClientSchema.safeParse({ name: "a".repeat(101) })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const result = createClientSchema.safeParse({
      name: "Test",
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative rate", () => {
    const result = createClientSchema.safeParse({ name: "Test", rate: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects invalid billing mode", () => {
    const result = createClientSchema.safeParse({
      name: "Test",
      billingMode: "WEEKLY",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid category", () => {
    const result = createClientSchema.safeParse({
      name: "Test",
      category: "UNKNOWN",
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from name", () => {
    const result = createClientSchema.safeParse({ name: "  Acme  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("Acme")
    }
  })
})

describe("updateClientSchema", () => {
  it("accepts empty object (no fields to update)", () => {
    const result = updateClientSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({})
    }
  })

  it("does not inject defaults for omitted fields", () => {
    const result = updateClientSchema.safeParse({ name: "Updated" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.billingMode).toBeUndefined()
      expect(result.data.rate).toBeUndefined()
      expect(result.data.category).toBeUndefined()
    }
  })

  it("validates provided fields", () => {
    const result = updateClientSchema.safeParse({ rate: -5 })
    expect(result.success).toBe(false)
  })
})

describe("clientFilterSchema", () => {
  it("applies defaults for empty input", () => {
    const result = clientFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
      expect(result.data.archived).toBe(false)
    }
  })

  it("coerces string numbers", () => {
    const result = clientFilterSchema.safeParse({ page: "3", limit: "50" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(50)
    }
  })

  it("rejects limit above 100", () => {
    const result = clientFilterSchema.safeParse({ limit: 101 })
    expect(result.success).toBe(false)
  })

  it("rejects negative page", () => {
    const result = clientFilterSchema.safeParse({ page: -1 })
    expect(result.success).toBe(false)
  })

  it("rejects zero page", () => {
    const result = clientFilterSchema.safeParse({ page: 0 })
    expect(result.success).toBe(false)
  })
})
