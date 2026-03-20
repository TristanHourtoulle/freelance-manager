import { prisma } from "@/lib/db"
import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { createExpenseSchema, expenseFilterSchema } from "@/lib/schemas/expense"
import { logAudit } from "@/lib/audit-log"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

import type { Prisma } from "@/generated/prisma/client"
import type { Expense } from "@/generated/prisma/client"

/** Converts Prisma Expense to a JSON-safe object (Decimal -> number). */
function serializeExpense(
  expense: Expense & { client?: { id: string; name: string } | null },
) {
  return {
    ...expense,
    amount: Number(expense.amount),
    clientName: expense.client?.name ?? null,
  }
}

/**
 * GET /api/expenses
 * Lists expenses with filtering, sorting, and pagination.
 * @returns 200 - `{ items: SerializedExpense[], pagination: { page, limit, total, totalPages } }`
 */
export async function GET(request: Request) {
  try {
    const rl = rateLimit(request)
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const filters = expenseFilterSchema.parse(params)

    const where: Prisma.ExpenseWhereInput = {
      userId: userOrError.id,
      deletedAt: null,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.recurring !== undefined
        ? { recurring: filters.recurring }
        : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    }

    const skip = (filters.page - 1) * filters.limit

    const [items, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        include: { client: { select: { id: true, name: true } } },
      }),
      prisma.expense.count({ where }),
    ])

    return NextResponse.json({
      items: items.map(serializeExpense),
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
 * POST /api/expenses
 * Creates a new expense for the authenticated user.
 * @returns 201 - The created expense
 */
export async function POST(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 30, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body = await request.json()
    const validated = createExpenseSchema.parse(body)

    const expense = await prisma.expense.create({
      data: {
        ...validated,
        userId: userOrError.id,
      },
      include: { client: { select: { id: true, name: true } } },
    })

    logAudit({
      userId: userOrError.id,
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
    })

    return NextResponse.json(serializeExpense(expense), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
