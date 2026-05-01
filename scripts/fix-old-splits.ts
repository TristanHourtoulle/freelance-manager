import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })

interface SplitGroup {
  clientId: string
  totalOverride: number
  invoices: {
    id: string
    number: string
    lineLabel: string
    index: number
    total: number
  }[]
}

function lineFromTask(opts: {
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: number
  estimateDays: number | null
}): { qty: number; rate: number } {
  const est = opts.estimateDays ?? 1
  if (opts.billingMode === "DAILY") return { qty: est, rate: opts.rate }
  if (opts.billingMode === "HOURLY") return { qty: est * 8, rate: opts.rate }
  return { qty: 1, rate: 0 }
}

async function main() {
  const candidates = await prisma.invoice.findMany({
    where: { totalOverride: { not: null } },
    include: { lines: true },
  })

  const groups = new Map<string, SplitGroup>()
  for (const inv of candidates) {
    if (inv.lines.length !== 1) continue
    const line = inv.lines[0]!
    const m = line.label.match(/\((\d+)\/(\d+)\)\s*$/)
    if (!m) continue
    const partIndex = parseInt(m[1]!, 10)
    const partsTotal = parseInt(m[2]!, 10)
    const total = Number(inv.totalOverride) * partsTotal
    const key = `${inv.clientId}:${total}:${partsTotal}`
    let g = groups.get(key)
    if (!g) {
      g = {
        clientId: inv.clientId,
        totalOverride: Number(inv.totalOverride),
        invoices: [],
      }
      groups.set(key, g)
    }
    g.invoices.push({
      id: inv.id,
      number: inv.number,
      lineLabel: line.label,
      index: partIndex,
      total: Number(inv.totalOverride),
    })
  }

  if (groups.size === 0) {
    console.log("Aucun ancien split détecté.")
    return
  }

  console.log(`Détecté ${groups.size} groupe(s) de splits.`)

  for (const [key, group] of groups) {
    group.invoices.sort((a, b) => a.index - b.index)
    const first = group.invoices.find((i) => i.index === 1)
    if (!first) {
      console.warn(`Groupe ${key}: pas de partie 1/N, skip.`)
      continue
    }

    const tasks = await prisma.task.findMany({
      where: { invoiceId: first.id },
    })
    if (tasks.length === 0) {
      console.warn(`Groupe ${key}: aucune task liée à ${first.number}, skip.`)
      continue
    }

    const client = await prisma.client.findUnique({
      where: { id: group.clientId },
      select: { billingMode: true, rate: true },
    })
    if (!client) continue
    const clientRate = Number(client.rate)

    const baseTotal = group.totalOverride * group.invoices.length
    const partsTotal = group.invoices.length

    const newLines = tasks
      .sort((a, b) => a.linearIdentifier.localeCompare(b.linearIdentifier))
      .map((t, idx) => {
        const { qty, rate } = lineFromTask({
          billingMode: client.billingMode,
          rate: clientRate,
          estimateDays: t.estimate ? Number(t.estimate) : null,
        })
        return {
          taskId: t.id,
          label: `[${t.linearIdentifier}] ${t.title}`,
          qty,
          rate,
          position: idx,
        }
      })

    console.log(
      `Groupe ${first.number}…${group.invoices[group.invoices.length - 1]?.number}: ${tasks.length} tasks, baseTotal ${baseTotal}€, ${partsTotal} parts`,
    )

    for (const inv of group.invoices) {
      const partNote = `Acompte ${inv.index}/${partsTotal} — total contractuel ${baseTotal}€`
      await prisma.$transaction(async (tx) => {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: inv.id } })
        await tx.invoiceLine.createMany({
          data: newLines.map((l) => ({
            ...l,
            taskId: inv.id === first.id ? l.taskId : null,
            invoiceId: inv.id,
          })),
        })
        const subtotal = newLines.reduce((s, l) => s + l.qty * l.rate, 0)
        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            subtotal,
            notes: partNote,
          },
        })
      })
      console.log(`  → ${inv.number} mis à jour`)
    }
  }

  console.log("Terminé.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
