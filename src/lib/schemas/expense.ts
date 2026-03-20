import { z } from "zod/v4"

/** Allowed expense categories. */
export const ExpenseCategorySchema = z.enum([
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
])

/** Validates the request body when creating a new expense. */
export const createExpenseSchema = z.object({
  description: z.string().min(1).max(500).trim(),
  amount: z.number().positive(),
  date: z.coerce.date(),
  category: ExpenseCategorySchema.default("OTHER"),
  clientId: z.string().optional(),
  recurring: z.boolean().default(false),
  receiptUrl: z.url().optional(),
})

/** Validates the request body when updating an existing expense (all fields optional). */
export const updateExpenseSchema = z.object({
  description: z.string().min(1).max(500).trim().optional(),
  amount: z.number().positive().optional(),
  date: z.coerce.date().optional(),
  category: ExpenseCategorySchema.optional(),
  clientId: z.string().nullable().optional(),
  recurring: z.boolean().optional(),
  receiptUrl: z.url().nullable().optional(),
})

/** Sortable columns for the expense list endpoint. */
export const ExpenseSortBySchema = z.enum([
  "date",
  "amount",
  "category",
  "description",
])

/** Validates query parameters for the expense list endpoint. */
export const expenseFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: ExpenseCategorySchema.optional(),
  clientId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  recurring: z.coerce.boolean().optional(),
  sortBy: ExpenseSortBySchema.optional().default("date"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
})

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
export type ExpenseFilter = z.infer<typeof expenseFilterSchema>
