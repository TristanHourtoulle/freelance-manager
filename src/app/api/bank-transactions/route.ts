import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import {
  bankTransactionFilterSchema,
  importBankTransactionsSchema,
} from "@/lib/schemas/bank-transaction"
import { NextResponse } from "next/server"

import type { Prisma, BankTransaction } from "@/generated/prisma/client"

/** Converts Prisma BankTransaction to a JSON-safe object (Decimal -> number). */
function serializeBankTransaction(tx: BankTransaction) {
  return {
    ...tx,
    amount: Number(tx.amount),
  }
}

/**
 * GET /api/bank-transactions
 * Lists bank transactions with pagination and optional filters.
 * @returns 200 - `{ items, pagination }`
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = bankTransactionFilterSchema.parse(params)

    const where: Prisma.BankTransactionWhereInput = {
      userId: userOrError.id,
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.matched === true
        ? { matchedExpenseId: { not: null } }
        : filters.matched === false
          ? { matchedExpenseId: null }
          : {}),
    }

    const skip = (filters.page - 1) * filters.limit

    const [items, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { date: "desc" },
      }),
      prisma.bankTransaction.count({ where }),
    ])

    return NextResponse.json({
      items: items.map(serializeBankTransaction),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/bank-transactions
 * Imports bank transactions from parsed CSV data.
 * @returns 201 - `{ count }` number of created transactions
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = importBankTransactionsSchema.parse(body)

    const result = await prisma.bankTransaction.createMany({
      data: validated.transactions.map((tx) => ({
        userId: userOrError.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        bankName: tx.bankName ?? null,
      })),
    })

    return NextResponse.json({ count: result.count }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
