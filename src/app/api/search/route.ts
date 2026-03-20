import { getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { prisma } from "@/lib/db"
import { searchLinearIssues } from "@/lib/linear-service"
import { searchQuerySchema } from "@/lib/schemas/search"
import { NextResponse } from "next/server"

interface SearchClientResult {
  id: string
  name: string
  company: string | null
  category: string
}

interface SearchTaskResult {
  id: string
  identifier: string
  title: string
  url: string
}

interface SearchExpenseResult {
  id: string
  description: string
  amount: number
  date: Date
  category: string
}

/**
 * GET /api/search
 * Searches across clients, Linear issues, expenses, and invoices by query string.
 * @returns 200 - `{ clients, tasks, expenses, invoices }`
 * @throws 401 - Unauthenticated request
 * @throws 400 - Missing or invalid `q` query parameter
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const url = new URL(request.url)
    const params = Object.fromEntries(url.searchParams)
    const { q } = searchQuerySchema.parse(params)

    const [clients, tasks, rawExpenses, rawInvoices] = await Promise.all([
      prisma.client.findMany({
        where: {
          userId: userOrError.id,
          archivedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          company: true,
          category: true,
        },
        take: 5,
        orderBy: { name: "asc" },
      }) as Promise<SearchClientResult[]>,
      searchLinearIssues(q).catch((): SearchTaskResult[] => []),
      prisma.expense.findMany({
        where: {
          userId: userOrError.id,
          description: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          description: true,
          amount: true,
          date: true,
          category: true,
        },
        take: 5,
        orderBy: { date: "desc" },
      }),
      prisma.invoice.findMany({
        where: {
          client: { userId: userOrError.id },
          OR: [
            { client: { name: { contains: q, mode: "insensitive" } } },
            { client: { company: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: {
          id: true,
          month: true,
          totalAmount: true,
          status: true,
          client: { select: { name: true } },
        },
        take: 5,
        orderBy: { month: "desc" },
      }),
    ])

    const expenses: SearchExpenseResult[] = rawExpenses.map((e) => ({
      ...e,
      amount: Number(e.amount),
    }))

    const serializedInvoices = rawInvoices.map((inv) => ({
      ...inv,
      totalAmount: Number(inv.totalAmount),
    }))

    return NextResponse.json({
      clients,
      tasks,
      expenses,
      invoices: serializedInvoices,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
