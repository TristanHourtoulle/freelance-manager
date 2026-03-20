import { z } from "zod/v4"

/** Validates a single bank transaction row from CSV import. */
export const bankTransactionRowSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1).max(500).trim(),
  amount: z.number(),
  bankName: z.string().max(100).optional(),
})

/** Validates the bulk import payload. */
export const importBankTransactionsSchema = z.object({
  transactions: z.array(bankTransactionRowSchema).min(1).max(5000),
})

/** Validates the match/unmatch update payload. */
export const matchBankTransactionSchema = z.object({
  matchedExpenseId: z.string().nullable(),
})

/** Validates query parameters for the bank transactions list endpoint. */
export const bankTransactionFilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  matched: z
    .string()
    .transform((v) => {
      if (v === "true") return true
      if (v === "false") return false
      return undefined
    })
    .optional(),
})

export type BankTransactionRow = z.infer<typeof bankTransactionRowSchema>
export type ImportBankTransactionsInput = z.infer<
  typeof importBankTransactionsSchema
>
export type MatchBankTransactionInput = z.infer<
  typeof matchBankTransactionSchema
>
export type BankTransactionFilter = z.infer<typeof bankTransactionFilterSchema>
