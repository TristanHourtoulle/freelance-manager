import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { matchBankTransactionSchema } from "@/lib/schemas/bank-transaction"
import { NextResponse } from "next/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/bank-transactions/:id
 * Match or unmatch a bank transaction to an expense.
 * @returns 200 - The updated transaction
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("BANK_TX_NOT_FOUND", "Bank transaction not found", 404)
    }

    const body = await request.json()
    const validated = matchBankTransactionSchema.parse(body)

    // If matching to an expense, verify the expense belongs to the same user
    if (validated.matchedExpenseId) {
      const expense = await prisma.expense.findFirst({
        where: { id: validated.matchedExpenseId, userId: userOrError.id },
      })

      if (!expense) {
        return apiError("EXPENSE_NOT_FOUND", "Expense not found", 404)
      }

      // Check that the expense is not already matched to another transaction
      const alreadyMatched = await prisma.bankTransaction.findFirst({
        where: {
          matchedExpenseId: validated.matchedExpenseId,
          id: { not: id },
        },
      })

      if (alreadyMatched) {
        return apiError(
          "EXPENSE_ALREADY_MATCHED",
          "This expense is already matched to another bank transaction",
          409,
        )
      }
    }

    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: { matchedExpenseId: validated.matchedExpenseId },
    })

    return NextResponse.json({
      ...updated,
      amount: Number(updated.amount),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/bank-transactions/:id
 * Deletes a bank transaction.
 * @returns 204 - No content
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await context.params

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, userId: userOrError.id },
    })

    if (!existing) {
      return apiError("BANK_TX_NOT_FOUND", "Bank transaction not found", 404)
    }

    await prisma.bankTransaction.delete({ where: { id } })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return handleApiError(error)
  }
}
