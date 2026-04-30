// prisma/seed.ts — populate a freshly migrated database with realistic data
// matching design-reference/src/data.jsx. Idempotent: re-running will keep the
// demo user and refill clients/projects/tasks/invoices.

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

const DEMO_EMAIL = "demo@freelance.local"
const DEMO_NAME = "Tristan Hourtoulle"

async function main() {
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME },
    create: { id: "demo-user", email: DEMO_EMAIL, name: DEMO_NAME },
  })

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultCurrency: "EUR",
      defaultPaymentDays: 30,
      defaultRate: 500,
    },
  })

  // Wipe domain data for the demo user — keeps re-seed idempotent.
  await prisma.task.deleteMany({ where: { userId: user.id } })
  await prisma.invoiceLine.deleteMany({
    where: { invoice: { userId: user.id } },
  })
  await prisma.invoice.deleteMany({ where: { userId: user.id } })
  await prisma.project.deleteMany({ where: { userId: user.id } })
  await prisma.linearMapping.deleteMany({
    where: { client: { userId: user.id } },
  })
  await prisma.client.deleteMany({ where: { userId: user.id } })

  const clientsData = [
    {
      id: "demo-c1",
      firstName: "Henri",
      lastName: "Mistral",
      company: "Quintyss Limited",
      email: "henri@quintyss.io",
      billingMode: "DAILY" as const,
      rate: 650,
      color:
        "linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.18 320))",
    },
    {
      id: "demo-c2",
      firstName: "Coralie",
      lastName: "Ebring",
      company: "GYNECOLOGIE RUEIL",
      email: "c.ebring@gyn-rueil.fr",
      billingMode: "FIXED" as const,
      rate: 0,
      fixedPrice: 8400,
      deposit: 2520,
      color:
        "linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))",
    },
    {
      id: "demo-c3",
      firstName: "Paul",
      lastName: "Levy",
      company: "Moduloop",
      email: "paul@moduloop.app",
      billingMode: "FIXED" as const,
      rate: 0,
      fixedPrice: 12000,
      deposit: 4000,
      color:
        "linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.6 0.16 220))",
    },
    {
      id: "demo-c4",
      firstName: "Tahirihanitra",
      lastName: "Sambazafi",
      company: "Hosted",
      email: "tahiri@hosted.cloud",
      billingMode: "HOURLY" as const,
      rate: 75,
      color: "linear-gradient(135deg, oklch(0.6 0.17 0), oklch(0.55 0.18 350))",
    },
    {
      id: "demo-c5",
      firstName: "Léa",
      lastName: "Garnier",
      company: "Pivot Studio",
      email: "lea@pivot.studio",
      billingMode: "DAILY" as const,
      rate: 580,
      color:
        "linear-gradient(135deg, oklch(0.6 0.14 80), oklch(0.55 0.16 110))",
    },
  ]

  for (const c of clientsData) {
    await prisma.client.create({
      data: { ...c, userId: user.id, category: "FREELANCE" },
    })
  }

  const projectsData = [
    {
      id: "demo-p1",
      clientId: "demo-c1",
      key: "TRI",
      name: "quintyss-dashboard",
      description: "Refonte du dashboard interne admin",
      linearProjectId: "lp-tri-dashboard",
    },
    {
      id: "demo-p2",
      clientId: "demo-c1",
      key: "API",
      name: "quintyss-api",
      description: "Migration API v2 + auth",
      linearProjectId: "lp-tri-api",
    },
    {
      id: "demo-p3",
      clientId: "demo-c2",
      key: "GYN",
      name: "gyn-portal-patient",
      description: "Portail patient avec prise de rdv",
      linearProjectId: "lp-gyn-portal",
    },
    {
      id: "demo-p4",
      clientId: "demo-c3",
      key: "MOD",
      name: "moduloop-marketplace",
      description: "Marketplace SaaS modulaire",
      linearProjectId: "lp-mod-marketplace",
    },
    {
      id: "demo-p5",
      clientId: "demo-c4",
      key: "HST",
      name: "hosted-dns-tooling",
      description: "CLI + dashboard pour DNS",
      linearProjectId: "lp-hst-dns",
    },
    {
      id: "demo-p6",
      clientId: "demo-c5",
      key: "PVT",
      name: "pivot-website",
      description: "Site vitrine + CMS",
      linearProjectId: "lp-pvt-site",
    },
  ]

  for (const p of projectsData) {
    await prisma.project.create({
      data: { ...p, userId: user.id, status: "ACTIVE" },
    })
  }

  const taskTitles: Record<string, string[]> = {
    TRI: [
      "Layout & colocation per route",
      "Forms error UX",
      "Translate server errors via error.code",
      "Audit form error UX (invalid input until blur)",
      "Inline constants extraction",
      "Replace hex color inputs with Tailwind tokens",
      "Backend: add presigned PUT endpoint",
      "Data layer migration",
      "Hygiene & safety net",
      "Root error.tsx et not-found.tsx",
      "Refactor — vagues admin/support architectural",
      "Layout & colocation par route — vague 3",
      "Extraction des constantes inline",
      "Empty states pour tableaux principaux",
      "Skeleton loaders",
    ],
    API: [
      "JWT refresh strategy",
      "Rate limiter Redis",
      "Webhook signing v2",
      "Migrate /v1/users endpoint",
      "Sentry breadcrumbs cleanup",
      "OpenAPI doc regen",
    ],
    GYN: [
      "Page de prise de rdv mobile",
      "Auth patient via SMS OTP",
      "Calendrier dispo praticiens",
      "Dossier patient — résumé visites",
      "Notifications email rappel rdv",
    ],
    MOD: [
      "Onboarding marketplace v2",
      "Stripe Connect intégration",
      'Module produit "abonnement"',
      "Search Algolia setup",
      "Reviews + modération",
    ],
    HST: [
      "CLI: hosted dns import bind",
      "Bulk DNS edit UI",
      "Audit log per zone",
      "API tokens management",
    ],
    PVT: ["Hero animation Framer", "Blog MDX setup"],
  }

  let counter = 500
  for (const [key, titles] of Object.entries(taskTitles)) {
    const project = projectsData.find((p) => p.key === key)
    if (!project) continue
    for (const title of titles) {
      counter++
      const r = Math.random()
      let status: "DONE" | "PENDING_INVOICE" | "IN_PROGRESS" | "BACKLOG"
      if (r < 0.4) status = "DONE"
      else if (r < 0.7) status = "PENDING_INVOICE"
      else if (r < 0.9) status = "IN_PROGRESS"
      else status = "BACKLOG"
      const estimate = [0.25, 0.5, 0.5, 1, 1, 1, 1.5, 2, 2, 3][
        Math.floor(Math.random() * 10)
      ] as number
      const completedAt =
        status === "DONE" || status === "PENDING_INVOICE"
          ? randomPastDate(status === "DONE" ? 60 : 20)
          : null
      await prisma.task.create({
        data: {
          userId: user.id,
          clientId: project.clientId,
          projectId: project.id,
          linearIssueId: `li-${counter}`,
          linearIdentifier: `${key}-${counter}`,
          linearStateName:
            status === "DONE"
              ? "Done"
              : status === "PENDING_INVOICE"
                ? "Done"
                : status === "IN_PROGRESS"
                  ? "In Progress"
                  : "Backlog",
          linearStateType:
            status === "DONE" || status === "PENDING_INVOICE"
              ? "completed"
              : status === "IN_PROGRESS"
                ? "started"
                : "unstarted",
          title,
          status,
          priority: ["LOW", "MEDIUM", "HIGH"][Math.floor(Math.random() * 3)] as
            | "LOW"
            | "MEDIUM"
            | "HIGH",
          estimate,
          completedAt,
        },
      })
    }
  }

  let invNum = 1024

  const c1Done = await prisma.task.findMany({
    where: { clientId: "demo-c1", status: "DONE" },
    take: 18,
    orderBy: { createdAt: "asc" },
  })
  if (c1Done.length >= 6) {
    invNum++
    const batch = c1Done.slice(0, 6)
    const subtotal = batch.reduce(
      (s, t) => s + Number(t.estimate ?? 0) * 650,
      0,
    )
    const inv = await prisma.invoice.create({
      data: {
        userId: user.id,
        clientId: "demo-c1",
        projectId: "demo-p1",
        number: `2026-${invNum}`,
        status: "PAID",
        kind: "STANDARD",
        issueDate: new Date("2026-02-28"),
        dueDate: new Date("2026-03-30"),
        paidAt: new Date("2026-03-12"),
        subtotal,
        tax: 0,
        total: subtotal,
        lines: {
          create: batch.map((t, i) => ({
            taskId: t.id,
            label: `[${t.linearIdentifier}] ${t.title}`,
            qty: Number(t.estimate ?? 0),
            rate: 650,
            position: i,
          })),
        },
      },
    })
    await prisma.task.updateMany({
      where: { id: { in: batch.map((t) => t.id) } },
      data: { invoiceId: inv.id },
    })
  }

  invNum++
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: "demo-c2",
      projectId: "demo-p3",
      number: `2026-${invNum}`,
      status: "PAID",
      kind: "DEPOSIT",
      issueDate: new Date("2026-01-10"),
      dueDate: new Date("2026-01-25"),
      paidAt: new Date("2026-01-22"),
      subtotal: 2520,
      tax: 0,
      total: 2520,
      lines: {
        create: [
          {
            label: "Acompte 30% — Portail patient",
            qty: 1,
            rate: 2520,
            position: 0,
          },
        ],
      },
    },
  })

  invNum++
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: "demo-c2",
      projectId: "demo-p3",
      number: `2026-${invNum}`,
      status: "OVERDUE",
      kind: "STANDARD",
      issueDate: new Date("2026-03-20"),
      dueDate: new Date("2026-04-20"),
      subtotal: 3500,
      tax: 0,
      total: 3500,
      lines: {
        create: [
          {
            label: "Forfait étape 1 — Auth + RDV",
            qty: 1,
            rate: 3500,
            position: 0,
          },
        ],
      },
    },
  })

  invNum++
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: "demo-c3",
      projectId: "demo-p4",
      number: `2026-${invNum}`,
      status: "PAID",
      kind: "DEPOSIT",
      issueDate: new Date("2026-02-15"),
      dueDate: new Date("2026-03-01"),
      paidAt: new Date("2026-02-28"),
      subtotal: 4000,
      tax: 0,
      total: 4000,
      lines: {
        create: [
          {
            label: "Acompte 33% — Marketplace v2",
            qty: 1,
            rate: 4000,
            position: 0,
          },
        ],
      },
    },
  })

  invNum++
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: "demo-c3",
      projectId: "demo-p4",
      number: `2026-${invNum}`,
      status: "SENT",
      kind: "STANDARD",
      issueDate: new Date("2026-04-10"),
      dueDate: new Date("2026-05-10"),
      subtotal: 4000,
      tax: 0,
      total: 4000,
      lines: {
        create: [
          {
            label: "Étape 1 — Onboarding + Stripe Connect",
            qty: 1,
            rate: 4000,
            position: 0,
          },
        ],
      },
    },
  })

  invNum++
  await prisma.invoice.create({
    data: {
      userId: user.id,
      clientId: "demo-c5",
      projectId: "demo-p6",
      number: `2026-${invNum}`,
      status: "DRAFT",
      kind: "STANDARD",
      issueDate: new Date("2026-04-22"),
      dueDate: new Date("2026-05-22"),
      subtotal: 1160,
      tax: 0,
      total: 1160,
      lines: {
        create: [{ label: "Hero animation", qty: 2, rate: 580, position: 0 }],
      },
    },
  })

  console.log(`[seed] OK — user "${DEMO_EMAIL}" with full demo data`)
}

function randomPastDate(maxDaysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo))
  return d
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
