import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"

/**
 * POST /api/demo/seed
 * Creates demo data (clients, expenses, invoices) for the authenticated user.
 * Guard: only runs when the user has 0 clients to prevent duplicates.
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const userId = userOrError.id

    const existingClientCount = await prisma.client.count({
      where: { userId },
    })

    if (existingClientCount > 0) {
      return apiError(
        "DEMO_ALREADY_SEEDED",
        "Demo data can only be created when you have no existing clients.",
        409,
      )
    }

    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 10)

    // --- Clients ---
    const [acme, techStart] = await Promise.all([
      prisma.client.create({
        data: {
          userId,
          name: "Acme Corp",
          category: "FREELANCE",
          billingMode: "HOURLY",
          rate: 75,
          email: "billing@acme-corp.com",
          company: "Acme Corporation",
        },
      }),
      prisma.client.create({
        data: {
          userId,
          name: "TechStart",
          category: "SIDE_PROJECT",
          billingMode: "DAILY",
          rate: 500,
          email: "hello@techstart.io",
          company: "TechStart Inc.",
        },
      }),
      prisma.client.create({
        data: {
          userId,
          name: "EduLearn",
          category: "STUDY",
          billingMode: "FIXED",
          rate: 2000,
          email: "contact@edulearn.org",
          company: "EduLearn Foundation",
        },
      }),
    ])

    // --- Expenses ---
    await prisma.expense.createMany({
      data: [
        {
          userId,
          clientId: acme.id,
          category: "SOFTWARE",
          description: "JetBrains IDE license",
          amount: 24.9,
          date: lastMonth,
          recurring: true,
        },
        {
          userId,
          clientId: techStart.id,
          category: "SUBSCRIPTION",
          description: "Vercel Pro plan",
          amount: 20,
          date: lastMonth,
          recurring: true,
        },
        {
          userId,
          clientId: null,
          category: "HARDWARE",
          description: "USB-C hub",
          amount: 59.99,
          date: twoMonthsAgo,
          recurring: false,
        },
        {
          userId,
          clientId: acme.id,
          category: "TRAVEL",
          description: "Train ticket to client office",
          amount: 45.5,
          date: now,
          recurring: false,
        },
        {
          userId,
          clientId: null,
          category: "OFFICE",
          description: "Coworking day pass",
          amount: 15,
          date: lastMonth,
          recurring: false,
        },
      ],
    })

    // --- Invoices ---
    await Promise.all([
      prisma.invoice.create({
        data: {
          clientId: acme.id,
          month: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1),
          totalAmount: 3750,
          status: "PAID",
          paymentDueDate: new Date(
            lastMonth.getFullYear(),
            lastMonth.getMonth() + 1,
            15,
          ),
        },
      }),
      prisma.invoice.create({
        data: {
          clientId: techStart.id,
          month: new Date(now.getFullYear(), now.getMonth(), 1),
          totalAmount: 2500,
          status: "DRAFT",
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      created: { clients: 3, expenses: 5, invoices: 2 },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
