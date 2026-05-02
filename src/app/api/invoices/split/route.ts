import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { invoiceSplitSchema } from "@/lib/schemas/invoice-split"

function formatNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
}

/**
 * TODO(TRI-614 follow-up): wrap `allocateNumbers` inside the same
 * `prisma.$transaction` that creates the invoices, and acquire a
 * pg_advisory_xact_lock on the user (see src/lib/invoice-numbering.ts)
 * before the read. As-is, two concurrent POST /api/invoices/split
 * for the same user could pick the same numbers — currently a single-
 * user perso app, so deferred.
 *
 * Allocate `parts` distinct invoice numbers.
 *
 * When a `base` is provided, the trailing digit group is incremented
 * (zero-padded). Examples:
 *   - "F-2026-0001" + 4 → ["F-2026-0001", "F-2026-0002", "F-2026-0003", "F-2026-0004"]
 *   - "INV-42-temp" + 3 → ["INV-42-temp", "INV-43-temp", "INV-44-temp"]
 *   - "Henri-Q1" (no digits) + 2 → ["Henri-Q1-1", "Henri-Q1-2"]
 *
 * Without a base, falls back to clean auto-numbers (`{year}-{seq+1024+1}`).
 *
 * @throws Error listing collisions if any candidate is already in DB.
 */
async function allocateNumbers(
  userId: string,
  year: number,
  parts: number,
  base?: string,
): Promise<string[]> {
  const taken = new Set(
    (
      await prisma.invoice.findMany({
        where: { userId },
        select: { number: true },
      })
    ).map((r) => r.number),
  )

  if (base && base.trim()) {
    const trimmed = base.trim()
    const match = trimmed.match(/^(.*?)(\d+)(\D*)$/)
    const result: string[] = []
    const conflicts: string[] = []

    if (match) {
      const prefix = match[1] as string
      const numStr = match[2] as string
      const suffix = match[3] as string
      const padding = numStr.length
      let n = parseInt(numStr, 10)
      for (let i = 0; i < parts; i++) {
        const candidate = prefix + String(n).padStart(padding, "0") + suffix
        if (taken.has(candidate)) conflicts.push(candidate)
        result.push(candidate)
        taken.add(candidate)
        n += 1
      }
    } else {
      for (let i = 1; i <= parts; i++) {
        const candidate = `${trimmed}-${i}`
        if (taken.has(candidate)) conflicts.push(candidate)
        result.push(candidate)
        taken.add(candidate)
      }
    }

    if (conflicts.length) {
      throw new Error(
        `Ces numéros sont déjà utilisés : ${conflicts.join(", ")}`,
      )
    }
    return result
  }

  const result: string[] = []
  let seq = (await prisma.invoice.count({ where: { userId } })) + 1024 + 1
  for (let i = 0; i < parts; i++) {
    let candidate = formatNumber(year, seq)
    while (taken.has(candidate)) {
      seq += 1
      candidate = formatNumber(year, seq)
    }
    result.push(candidate)
    taken.add(candidate)
    seq += 1
  }
  return result
}

function shiftDate(
  iso: string,
  schedule: "MONTHLY" | "WEEKLY" | "ONCE",
  n: number,
): string {
  if (schedule === "ONCE" || n === 0) return iso
  const d = new Date(iso)
  if (schedule === "MONTHLY") d.setMonth(d.getMonth() + n)
  else if (schedule === "WEEKLY") d.setDate(d.getDate() + 7 * n)
  return d.toISOString().slice(0, 10)
}

/**
 * POST /api/invoices/split
 *
 * Splits a single invoice payload into N installments. Each installment gets
 * `total / N` as its totalOverride (so lines remain decorative across all
 * parts) and a dueDate shifted by the chosen schedule. Tasks linked in the
 * payload's `taskIds` are attached to the FIRST installment only.
 *
 * @returns `{ items: [{ id, number, total, dueDate }, …] }`
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const data = invoiceSplitSchema.parse(await req.json())
    const base = data.base
    const parts = data.parts

    const owned = await prisma.client.findFirst({
      where: { id: base.clientId, userId: user.id },
      select: { id: true },
    })
    if (!owned) return apiUnauthorized()

    const subtotal = base.lines.reduce(
      (s, l) => s + Number(l.qty) * Number(l.rate),
      0,
    )
    const baseTotal =
      base.totalOverride != null ? Number(base.totalOverride) : subtotal
    const partAmount = Math.round((baseTotal / parts) * 100) / 100

    const year = new Date(base.issueDate).getFullYear()
    const numbers = await allocateNumbers(user.id, year, parts, base.number)

    const created = await prisma.$transaction(async (tx) => {
      const out: {
        id: string
        number: string
        total: number
        dueDate: string
      }[] = []
      for (let i = 0; i < parts; i++) {
        const isFirst = i === 0
        const dueDate = shiftDate(base.dueDate, data.schedule, i)
        const partNote = `Acompte ${i + 1}/${parts} — total contractuel ${baseTotal}€`
        const inv = await tx.invoice.create({
          data: {
            userId: user.id,
            clientId: base.clientId,
            projectId: base.projectId ?? null,
            number: numbers[i] as string,
            status: base.status,
            kind: base.kind,
            issueDate: new Date(base.issueDate),
            dueDate: new Date(dueDate),
            subtotal,
            tax: 0,
            total: partAmount,
            totalOverride: partAmount,
            notes: base.notes ? `${partNote}\n${base.notes}` : partNote,
            lines: {
              create: base.lines.map((l, idx) => ({
                taskId: isFirst ? (l.taskId ?? null) : null,
                label: l.label,
                qty: Number(l.qty),
                rate: Number(l.rate),
                position: idx,
              })),
            },
          },
        })
        out.push({
          id: inv.id,
          number: inv.number,
          total: partAmount,
          dueDate,
        })
      }

      if (base.taskIds?.length && out[0]) {
        await tx.task.updateMany({
          where: { id: { in: base.taskIds }, userId: user.id },
          data: { invoiceId: out[0].id, status: "DONE" },
        })
      }

      return out
    })

    return NextResponse.json({ items: created }, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
