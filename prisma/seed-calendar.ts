/**
 * Seed script to create test invoices with payment due dates for the calendar page.
 * Run with: pnpm tsx prisma/seed-calendar.ts
 */
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  // Find the first user
  const user = await prisma.user.findFirst()
  if (!user) {
    console.log("No user found. Please register first.")
    return
  }

  // Find user's clients
  const clients = await prisma.client.findMany({
    where: { userId: user.id, archivedAt: null },
    take: 3,
  })

  if (clients.length === 0) {
    console.log("No clients found. Please create clients first.")
    return
  }

  const now = new Date()

  const invoiceData = [
    {
      // Overdue by 5 days
      clientId: clients[0]!.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 2500,
      status: "SENT" as const,
      paymentDueDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      // Due in 3 days
      clientId: clients[0]!.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 3200,
      status: "SENT" as const,
      paymentDueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      // Due in 15 days
      clientId: clients[Math.min(1, clients.length - 1)]!.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 1800,
      status: "SENT" as const,
      paymentDueDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000),
    },
    {
      // Due in 30 days
      clientId: clients[Math.min(2, clients.length - 1)]!.id,
      month: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      totalAmount: 4500,
      status: "DRAFT" as const,
      paymentDueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      // Due in 60 days
      clientId: clients[0]!.id,
      month: new Date(now.getFullYear(), now.getMonth() + 2, 1),
      totalAmount: 2100,
      status: "SENT" as const,
      paymentDueDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
    },
  ]

  for (const data of invoiceData) {
    // Use upsert to avoid duplicate constraint violations
    const existing = await prisma.invoice.findUnique({
      where: {
        clientId_month: {
          clientId: data.clientId,
          month: data.month,
        },
      },
    })

    if (existing) {
      await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          totalAmount: data.totalAmount,
          status: data.status,
          paymentDueDate: data.paymentDueDate,
        },
      })
      console.log(
        `Updated invoice for client ${data.clientId} (${data.month.toISOString().slice(0, 7)})`,
      )
    } else {
      await prisma.invoice.create({ data })
      console.log(
        `Created invoice for client ${data.clientId} (${data.month.toISOString().slice(0, 7)})`,
      )
    }
  }

  console.log("\nDone! Visit /calendar to see the deadlines.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
