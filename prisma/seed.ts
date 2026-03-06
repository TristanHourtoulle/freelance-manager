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
  // Clean existing data (order matters due to foreign keys)
  await prisma.$transaction([
    prisma.invoice.deleteMany(),
    prisma.taskOverride.deleteMany(),
    prisma.linearMapping.deleteMany(),
    prisma.client.deleteMany(),
  ])

  // Get or create test users
  let user = await prisma.user.findFirst({
    where: { email: "test@freelancedash.dev" },
  })
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Test User",
        email: "test@freelancedash.dev",
        emailVerified: true,
      },
    })
  }

  let tristanUser = await prisma.user.findFirst({
    where: { email: "tristan68420@gmail.com" },
  })
  if (!tristanUser) {
    tristanUser = await prisma.user.create({
      data: {
        name: "Tristan Hourtoulle",
        email: "tristan68420@gmail.com",
        emailVerified: true,
      },
    })
  }

  // Seed clients
  const acmeCorp = await prisma.client.create({
    data: {
      userId: user.id,
      name: "Acme Corp",
      email: "contact@acme.com",
      company: "Acme Corporation",
      billingMode: "DAILY",
      rate: 500,
      category: "FREELANCE",
      notes: "Main client — web platform redesign",
    },
  })

  const startupXyz = await prisma.client.create({
    data: {
      userId: user.id,
      name: "Startup XYZ",
      email: "hello@startupxyz.io",
      company: "Startup XYZ Inc.",
      billingMode: "HOURLY",
      rate: 75,
      category: "FREELANCE",
    },
  })

  await prisma.client.create({
    data: {
      userId: user.id,
      name: "University Capstone",
      billingMode: "FREE",
      rate: 0,
      category: "STUDY",
      notes: "Final year capstone project",
    },
  })

  await prisma.client.create({
    data: {
      userId: user.id,
      name: "Personal Blog",
      billingMode: "FIXED",
      rate: 2000,
      category: "SIDE_PROJECT",
    },
  })

  // Seed linear mappings
  await prisma.linearMapping.createMany({
    data: [
      {
        clientId: acmeCorp.id,
        linearTeamId: "team-acme-001",
        linearProjectId: "proj-acme-web-001",
      },
      {
        clientId: startupXyz.id,
        linearTeamId: "team-xyz-001",
      },
    ],
  })

  // Seed task overrides
  await prisma.taskOverride.createMany({
    data: [
      {
        clientId: acmeCorp.id,
        linearIssueId: "ACME-101",
        toInvoice: true,
        invoiced: true,
        invoicedAt: new Date("2026-02-28"),
      },
      {
        clientId: acmeCorp.id,
        linearIssueId: "ACME-102",
        toInvoice: true,
        invoiced: false,
      },
      {
        clientId: acmeCorp.id,
        linearIssueId: "ACME-103",
        toInvoice: false,
      },
      {
        clientId: startupXyz.id,
        linearIssueId: "XYZ-201",
        toInvoice: true,
        invoiced: false,
        rateOverride: 90,
      },
    ],
  })

  // Seed invoices
  await prisma.invoice.createMany({
    data: [
      {
        clientId: acmeCorp.id,
        month: new Date("2026-02-01"),
        totalAmount: 3500,
        status: "PAID",
      },
      {
        clientId: startupXyz.id,
        month: new Date("2026-02-01"),
        totalAmount: 1200,
        status: "SENT",
      },
    ],
  })

  console.info(
    "Seed completed: 4 clients, 2 mappings, 4 task overrides, 2 invoices",
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
