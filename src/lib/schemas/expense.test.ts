import { describe, it, expect } from "vitest"
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseFilterSchema,
  ExpenseCategorySchema,
} from "./expense"

describe("ExpenseCategorySchema", () => {
  it("accepts all valid categories", () => {
    const categories = [
      "SUBSCRIPTION",
      "SOFTWARE",
      "HARDWARE",
      "TRAVEL",
      "OFFICE",
      "MARKETING",
      "LEGAL",
      "PROFESSIONAL",
      "PERSONAL",
      "ENTERTAINMENT",
      "OTHER",
    ]
    for (const cat of categories) {
      expect(ExpenseCategorySchema.safeParse(cat).success).toBe(true)
    }
  })

  it("rejects invalid category", () => {
    expect(ExpenseCategorySchema.safeParse("FOOD").success).toBe(false)
  })
})

describe("createExpenseSchema", () => {
  const validInput = {
    description: "Domain renewal",
    amount: 12.99,
    date: "2026-01-15",
  }

  it("accepts valid input with defaults", () => {
    const result = createExpenseSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe("Domain renewal")
      expect(result.data.amount).toBe(12.99)
      expect(result.data.category).toBe("OTHER")
      expect(result.data.recurring).toBe(false)
      expect(result.data.date).toBeInstanceOf(Date)
    }
  })

  it("accepts full valid input", () => {
    const result = createExpenseSchema.safeParse({
      ...validInput,
      category: "SOFTWARE",
      clientId: "client-123",
      recurring: true,
      receiptUrl: "https://example.com/receipt.pdf",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty description", () => {
    const result = createExpenseSchema.safeParse({
      ...validInput,
      description: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing description", () => {
    const { description: _, ...rest } = validInput
    expect(createExpenseSchema.safeParse(rest).success).toBe(false)
  })

  it("rejects description exceeding 500 characters", () => {
    const result = createExpenseSchema.safeParse({
      ...validInput,
      description: "a".repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from description", () => {
    const result = createExpenseSchema.safeParse({
      ...validInput,
      description: "  trimmed  ",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe("trimmed")
    }
  })

  it("rejects zero amount", () => {
    expect(
      createExpenseSchema.safeParse({ ...validInput, amount: 0 }).success,
    ).toBe(false)
  })

  it("rejects negative amount", () => {
    expect(
      createExpenseSchema.safeParse({ ...validInput, amount: -5 }).success,
    ).toBe(false)
  })

  it("rejects missing amount", () => {
    const { amount: _, ...rest } = validInput
    expect(createExpenseSchema.safeParse(rest).success).toBe(false)
  })

  it("coerces date string to Date", () => {
    const result = createExpenseSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date)
    }
  })

  it("rejects invalid date", () => {
    expect(
      createExpenseSchema.safeParse({ ...validInput, date: "not-a-date" })
        .success,
    ).toBe(false)
  })

  it("rejects invalid receiptUrl", () => {
    expect(
      createExpenseSchema.safeParse({ ...validInput, receiptUrl: "not-a-url" })
        .success,
    ).toBe(false)
  })

  it("rejects invalid category", () => {
    expect(
      createExpenseSchema.safeParse({ ...validInput, category: "FOOD" })
        .success,
    ).toBe(false)
  })
})

describe("updateExpenseSchema", () => {
  it("accepts empty object", () => {
    const result = updateExpenseSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({})
    }
  })

  it("accepts partial update", () => {
    const result = updateExpenseSchema.safeParse({ amount: 25 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.amount).toBe(25)
      expect(result.data.description).toBeUndefined()
    }
  })

  it("allows nullable clientId", () => {
    const result = updateExpenseSchema.safeParse({ clientId: null })
    expect(result.success).toBe(true)
  })

  it("allows nullable receiptUrl", () => {
    const result = updateExpenseSchema.safeParse({ receiptUrl: null })
    expect(result.success).toBe(true)
  })

  it("validates provided fields", () => {
    expect(updateExpenseSchema.safeParse({ amount: -1 }).success).toBe(false)
  })
})

describe("expenseFilterSchema", () => {
  it("applies defaults for empty input", () => {
    const result = expenseFilterSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it("coerces string numbers", () => {
    const result = expenseFilterSchema.safeParse({ page: "2", limit: "50" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(2)
      expect(result.data.limit).toBe(50)
    }
  })

  it("rejects limit above 100", () => {
    expect(expenseFilterSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it("rejects zero page", () => {
    expect(expenseFilterSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it("coerces date strings in dateFrom and dateTo", () => {
    const result = expenseFilterSchema.safeParse({
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dateFrom).toBeInstanceOf(Date)
      expect(result.data.dateTo).toBeInstanceOf(Date)
    }
  })

  it("accepts valid category filter", () => {
    const result = expenseFilterSchema.safeParse({ category: "TRAVEL" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid category filter", () => {
    expect(expenseFilterSchema.safeParse({ category: "FOOD" }).success).toBe(
      false,
    )
  })

  it("coerces recurring boolean from string", () => {
    const result = expenseFilterSchema.safeParse({ recurring: "true" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recurring).toBe(true)
    }
  })
})
