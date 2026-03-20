import { NextResponse } from "next/server"

import { apiError } from "@/lib/api-utils"
import { prisma } from "@/lib/db"

/**
 * POST /api/expenses/recurring
 * Processes recurring expenses by creating new entries for the current month.
 * Secured via `x-cron-secret` header (no user auth required).
 * @returns 200 - `{ created: number, skipped: number }`
 * @throws 401 - Missing or invalid cron secret
 */
export async function POST(request: Request): Promise<NextResponse> {
  const cronSecret = request.headers.get("x-cron-secret")

  if (cronSecret !== process.env.CRON_SECRET) {
    return apiError("AUTH_UNAUTHORIZED", "Invalid cron secret", 401)
  }

  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const currentMonthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  )

  const recurringExpenses = await prisma.expense.findMany({
    where: { recurring: true },
  })

  // Group by unique template (description + amount + category + userId + clientId)
  const templateMap = new Map<string, (typeof recurringExpenses)[number]>()

  for (const expense of recurringExpenses) {
    const key = [
      expense.description,
      String(expense.amount),
      expense.category,
      expense.userId,
      expense.clientId ?? "",
    ].join("|")

    if (!templateMap.has(key)) {
      templateMap.set(key, expense)
    }
  }

  let created = 0
  let skipped = 0

  for (const [, template] of templateMap) {
    const existingThisMonth = await prisma.expense.findFirst({
      where: {
        description: template.description,
        amount: template.amount,
        category: template.category,
        userId: template.userId,
        clientId: template.clientId,
        date: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
    })

    if (existingThisMonth) {
      skipped++
      continue
    }

    await prisma.expense.create({
      data: {
        description: template.description,
        amount: template.amount,
        category: template.category,
        userId: template.userId,
        clientId: template.clientId,
        date: currentMonthStart,
        recurring: true,
      },
    })

    created++
  }

  return NextResponse.json({ created, skipped })
}
