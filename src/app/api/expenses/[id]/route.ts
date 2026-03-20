import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { updateExpenseSchema } from "@/lib/schemas/expense"
import { NextResponse } from "next/server"

import type { Expense } from "@/generated/prisma/client"

interface RouteContext {
  params: Promise<{ id: string }>
}

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
 * GET /api/expenses/:id
 * Retrieves a single expense by ID.
 * @returns 200 - The expense
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const expense = await prisma.expense.findFirst({
      where: { id, userId: userOrError.id },
      include: { client: { select: { id: true, name: true } } },
    })

    if (!expense) {
      return apiError("EXPENSE_NOT_FOUND", "Expense not found", 404)
    }

    return NextResponse.json(serializeExpense(expense))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/expenses/:id
 * Updates an existing expense by ID.
 * @returns 200 - The updated expense
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.expense.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("EXPENSE_NOT_FOUND", "Expense not found", 404)
    }

    const body = await request.json()
    const validated = updateExpenseSchema.parse(body)

    const expense = await prisma.expense.update({
      where: { id },
      data: validated,
      include: { client: { select: { id: true, name: true } } },
    })

    return NextResponse.json(serializeExpense(expense))
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/expenses/:id
 * Permanently deletes an expense by ID.
 * @returns 204 - No content
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.expense.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("EXPENSE_NOT_FOUND", "Expense not found", 404)
    }

    await prisma.expense.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
