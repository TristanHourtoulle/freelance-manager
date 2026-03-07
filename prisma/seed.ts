import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../src/generated/prisma/client"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const TARGET_EMAIL = "tristan68420@gmail.com"

  const user = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL },
  })

  if (!user) {
    console.error(
      `User ${TARGET_EMAIL} not found. Please sign up first at localhost:3000.`,
    )
    process.exit(1)
  }

  console.info(`Found user: ${user.name} (${user.id})`)

  // Clean existing data for this user (order matters due to foreign keys)
  const existingClients = await prisma.client.findMany({
    where: { userId: user.id },
    select: { id: true },
  })
  const clientIds = existingClients.map((c) => c.id)

  if (clientIds.length > 0) {
    await prisma.$transaction([
      prisma.invoice.deleteMany({ where: { clientId: { in: clientIds } } }),
      prisma.taskOverride.deleteMany({
        where: { clientId: { in: clientIds } },
      }),
      prisma.linearMapping.deleteMany({
        where: { clientId: { in: clientIds } },
      }),
      prisma.client.deleteMany({ where: { userId: user.id } }),
    ])
    console.info(`Cleaned ${clientIds.length} existing clients.`)
  }

  // --- Create clients across all 4 categories ---

  const clients = await Promise.all([
    // FREELANCE (3 clients)
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Acme Corp",
        email: "contact@acme.com",
        company: "Acme Corporation",
        billingMode: "HOURLY",
        rate: 85,
        category: "FREELANCE",
        notes: "Main freelance client - web platform redesign",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "TechStart SAS",
        email: "hello@techstart.fr",
        company: "TechStart",
        billingMode: "DAILY",
        rate: 650,
        category: "FREELANCE",
        notes: "Mobile app development contract",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Digital Agency",
        email: "pm@digitalagency.io",
        company: "Digital Agency Ltd",
        billingMode: "HOURLY",
        rate: 95,
        category: "FREELANCE",
        notes: "Frontend consulting and UI reviews",
      },
    }),
    // STUDY (2 clients)
    prisma.client.create({
      data: {
        userId: user.id,
        name: "University Capstone",
        email: "prof@epitech.eu",
        company: "Epitech",
        billingMode: "FREE",
        rate: 0,
        category: "STUDY",
        notes: "Final year capstone project",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Research Lab",
        email: "lab@cnrs.fr",
        company: "CNRS",
        billingMode: "HOURLY",
        rate: 25,
        category: "STUDY",
        notes: "Part-time research assistant",
      },
    }),
    // PERSONAL (2 clients)
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Portfolio Website",
        billingMode: "FREE",
        rate: 0,
        category: "PERSONAL",
        notes: "Personal portfolio redesign",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Home Automation",
        billingMode: "FREE",
        rate: 0,
        category: "PERSONAL",
        notes: "Smart home IoT project",
      },
    }),
    // SIDE_PROJECT (3 clients)
    prisma.client.create({
      data: {
        userId: user.id,
        name: "SaaS MVP",
        email: "co-founder@saas.dev",
        company: "SaaS Co",
        billingMode: "FIXED",
        rate: 3000,
        category: "SIDE_PROJECT",
        notes: "Co-founded SaaS product",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Open Source CLI",
        billingMode: "FREE",
        rate: 0,
        category: "SIDE_PROJECT",
        notes: "Open source developer tool",
      },
    }),
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Mobile Game",
        billingMode: "FIXED",
        rate: 1500,
        category: "SIDE_PROJECT",
        notes: "Indie mobile game",
      },
    }),
    // Archived client (should NOT appear in analytics)
    prisma.client.create({
      data: {
        userId: user.id,
        name: "Old Client (Archived)",
        email: "old@client.com",
        billingMode: "HOURLY",
        rate: 60,
        category: "FREELANCE",
        archivedAt: new Date("2025-12-01"),
        notes: "This client is archived and should not appear",
      },
    }),
  ])

  const [
    acme,
    techstart,
    digitalAgency,
    uniCapstone,
    researchLab,
    portfolio,
    homeAuto,
    saasMvp,
    osCli,
    mobileGame,
    archivedClient,
  ] = clients

  console.info(`Created ${clients.length} clients (1 archived).`)

  // --- Create task overrides ---

  const now = new Date()
  let issueId = 1000

  function makeInvoicedTasks(
    clientId: string,
    monthsAgo: number,
    count: number,
    rateOverride?: number,
  ) {
    return Array.from({ length: count }, (_, i) => ({
      clientId,
      linearIssueId: `SEED-${issueId++}`,
      toInvoice: false,
      invoiced: true,
      invoicedAt: new Date(
        now.getFullYear(),
        now.getMonth() - monthsAgo,
        Math.min(28, 3 + i * 4),
      ),
      rateOverride: rateOverride ?? null,
    }))
  }

  function makePendingTasks(clientId: string, count: number) {
    return Array.from({ length: count }, () => ({
      clientId,
      linearIssueId: `SEED-${issueId++}`,
      toInvoice: true,
      invoiced: false,
      invoicedAt: null,
      rateOverride: null,
    }))
  }

  const invoicedTasks = [
    // Acme Corp (FREELANCE, HOURLY 85) - heaviest client
    ...makeInvoicedTasks(acme.id, 0, 5),
    ...makeInvoicedTasks(acme.id, 1, 8),
    ...makeInvoicedTasks(acme.id, 2, 6),
    ...makeInvoicedTasks(acme.id, 3, 4),
    ...makeInvoicedTasks(acme.id, 5, 3),
    ...makeInvoicedTasks(acme.id, 8, 2),
    // one task with premium rate override
    ...makeInvoicedTasks(acme.id, 1, 1, 120),

    // TechStart SAS (FREELANCE, DAILY 650)
    ...makeInvoicedTasks(techstart.id, 0, 3),
    ...makeInvoicedTasks(techstart.id, 1, 4),
    ...makeInvoicedTasks(techstart.id, 2, 5),
    ...makeInvoicedTasks(techstart.id, 4, 2),

    // Digital Agency (FREELANCE, HOURLY 95)
    ...makeInvoicedTasks(digitalAgency.id, 0, 2),
    ...makeInvoicedTasks(digitalAgency.id, 1, 3),
    ...makeInvoicedTasks(digitalAgency.id, 3, 4),
    ...makeInvoicedTasks(digitalAgency.id, 6, 2),

    // Research Lab (STUDY, HOURLY 25) - lower amounts
    ...makeInvoicedTasks(researchLab.id, 0, 2),
    ...makeInvoicedTasks(researchLab.id, 1, 3),
    ...makeInvoicedTasks(researchLab.id, 2, 4),
    ...makeInvoicedTasks(researchLab.id, 5, 2),

    // SaaS MVP (SIDE_PROJECT, FIXED 3000)
    ...makeInvoicedTasks(saasMvp.id, 0, 2),
    ...makeInvoicedTasks(saasMvp.id, 2, 1),
    ...makeInvoicedTasks(saasMvp.id, 4, 1),

    // Mobile Game (SIDE_PROJECT, FIXED 1500)
    ...makeInvoicedTasks(mobileGame.id, 1, 2),
    ...makeInvoicedTasks(mobileGame.id, 3, 1),

    // Archived client tasks (should be filtered out by analytics query)
    ...makeInvoicedTasks(archivedClient.id, 0, 3),
  ]

  const pendingTasks = [
    ...makePendingTasks(acme.id, 3),
    ...makePendingTasks(techstart.id, 2),
    ...makePendingTasks(digitalAgency.id, 1),
    ...makePendingTasks(researchLab.id, 2),
    ...makePendingTasks(saasMvp.id, 1),
    ...makePendingTasks(portfolio.id, 2),
    ...makePendingTasks(homeAuto.id, 1),
    ...makePendingTasks(osCli.id, 1),
  ]

  await prisma.taskOverride.createMany({
    data: [...invoicedTasks, ...pendingTasks],
  })
  console.info(
    `Created ${invoicedTasks.length} invoiced + ${pendingTasks.length} pending task overrides.`,
  )

  // --- Create invoices ---

  const invoices = [
    // Acme Corp
    {
      clientId: acme.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 4250,
      status: "DRAFT" as const,
    },
    {
      clientId: acme.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 7650,
      status: "SENT" as const,
    },
    {
      clientId: acme.id,
      month: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      totalAmount: 5100,
      status: "PAID" as const,
    },
    {
      clientId: acme.id,
      month: new Date(now.getFullYear(), now.getMonth() - 3, 1),
      totalAmount: 3400,
      status: "PAID" as const,
    },
    // TechStart
    {
      clientId: techstart.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 1950,
      status: "DRAFT" as const,
    },
    {
      clientId: techstart.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 2600,
      status: "PAID" as const,
    },
    {
      clientId: techstart.id,
      month: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      totalAmount: 3250,
      status: "PAID" as const,
    },
    // Digital Agency
    {
      clientId: digitalAgency.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 1900,
      status: "DRAFT" as const,
    },
    {
      clientId: digitalAgency.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 2850,
      status: "SENT" as const,
    },
    // Research Lab
    {
      clientId: researchLab.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 500,
      status: "DRAFT" as const,
    },
    {
      clientId: researchLab.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 750,
      status: "PAID" as const,
    },
    // SaaS MVP
    {
      clientId: saasMvp.id,
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      totalAmount: 6000,
      status: "DRAFT" as const,
    },
    {
      clientId: saasMvp.id,
      month: new Date(now.getFullYear(), now.getMonth() - 2, 1),
      totalAmount: 3000,
      status: "PAID" as const,
    },
    // Mobile Game
    {
      clientId: mobileGame.id,
      month: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      totalAmount: 3000,
      status: "SENT" as const,
    },
  ]

  await prisma.invoice.createMany({ data: invoices })
  console.info(`Created ${invoices.length} invoices.`)

  console.info("\n--- Seed Summary ---")
  console.info("Clients: 10 active + 1 archived")
  console.info("  FREELANCE:    Acme Corp, TechStart SAS, Digital Agency")
  console.info("  STUDY:        University Capstone, Research Lab")
  console.info("  PERSONAL:     Portfolio Website, Home Automation")
  console.info("  SIDE_PROJECT: SaaS MVP, Open Source CLI, Mobile Game")
  console.info(
    `Task overrides: ${invoicedTasks.length} invoiced, ${pendingTasks.length} pending`,
  )
  console.info(`Invoices: ${invoices.length}`)
  console.info("Done!")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
