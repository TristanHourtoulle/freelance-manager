import "server-only"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { collectInvoicedTaskIds } from "@/domain/billing/invoiced-tasks"
import { nextAutoNumber } from "@/lib/invoice-numbering"
import { allocateSplitAmounts } from "@/lib/billing-math"
import { recomputeInvoicePayment } from "@/lib/payments"
import { paymentCreateSchema } from "@/lib/schemas/payment"
import { invoicesTag } from "@/lib/data/invoices"
import { navTag } from "@/lib/data/nav"
import { deferActivityLog } from "@/lib/activity"
import {
  draftLineInputSchema,
  invoiceKindSchema,
  paymentStatusSchema,
} from "@/lib/mcp/tools/invoices"
import {
  isoDateInputSchema,
  McpToolError,
  mcpNotFound,
  parseIsoDate,
  runMcpTool,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const splitScheduleSchema = z.enum(["MONTHLY", "WEEKLY", "ONCE"])

const updateInvoiceDraftInput = z.object({
  invoiceId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  number: z.string().min(1).max(40).optional(),
  kind: invoiceKindSchema,
  issueDate: isoDateInputSchema,
  dueDate: isoDateInputSchema,
  notes: z.string().max(2000).optional(),
  totalOverride: z
    .number()
    .min(0)
    .max(10_000_000)
    .optional()
    .nullable()
    .describe("Forfait override; omit or null to bill the sum of lines"),
  lines: z.array(draftLineInputSchema).min(1).max(100),
  taskIds: z
    .array(z.string().min(1))
    .max(200)
    .optional()
    .describe("Extra task ids to attach to the invoice"),
})

const updateInvoiceDraftOutput = z.object({
  id: z.string(),
  number: z.string(),
  status: z.literal("DRAFT"),
  clientId: z.string(),
  projectId: z.string().nullable(),
  kind: invoiceKindSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  subtotal: z.number(),
  total: z.number(),
  linesCount: z.number(),
})

const splitInvoiceInput = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  kind: invoiceKindSchema.default("STANDARD"),
  issueDate: isoDateInputSchema,
  dueDate: isoDateInputSchema,
  notes: z.string().max(2000).optional(),
  lines: z.array(draftLineInputSchema).min(1).max(100),
  taskIds: z
    .array(z.string().min(1))
    .max(200)
    .optional()
    .describe("Task ids attached to the FIRST installment only"),
  totalOverride: z
    .number()
    .min(0)
    .max(10_000_000)
    .optional()
    .describe("Contract total to split instead of the sum of lines"),
  parts: z.number().int().min(2).max(36),
  schedule: splitScheduleSchema.default("MONTHLY"),
})

const splitInvoiceOutput = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      number: z.string(),
      total: z.number(),
      dueDate: z.string(),
    }),
  ),
})

const recordPaymentInput = paymentCreateSchema.extend({
  invoiceId: z.string().min(1),
})

const recordPaymentOutput = z.object({
  id: z.string(),
  invoiceId: z.string(),
  amount: z.number(),
  paidAt: z.string(),
  paymentStatus: paymentStatusSchema,
  balanceDue: z.number(),
})

type UpdateInvoiceDraftArgs = z.output<typeof updateInvoiceDraftInput>
type SplitInvoiceArgs = z.output<typeof splitInvoiceInput>
type RecordPaymentArgs = z.output<typeof recordPaymentInput>

/**
 * Compute an installment's due date for {@link splitInvoice}, shifting the
 * base date by `n` periods of `schedule`. Mirrors `shiftDate` from
 * `POST /api/invoices/split`.
 *
 * @param iso - Base ISO date (`YYYY-MM-DD`).
 * @param schedule - Cadence between installments.
 * @param n - Installment index (0 = the base date itself).
 * @returns The shifted ISO date.
 */
function shiftSplitDate(
  iso: string,
  schedule: z.infer<typeof splitScheduleSchema>,
  n: number,
): string {
  if (schedule === "ONCE" || n === 0) return iso
  const d = new Date(iso)
  if (schedule === "MONTHLY") d.setMonth(d.getMonth() + n)
  else d.setDate(d.getDate() + 7 * n)
  return d.toISOString().slice(0, 10)
}

/**
 * Handler for the update_invoice_draft tool.
 *
 * Refuses with an `isError` result unless the invoice is still DRAFT — this
 * is a full-replace like `PATCH /api/invoices/[id]`, never a status change.
 * The status written back is always DRAFT regardless of what the model
 * sends (there is no `status` input at all), so this tool can never send an
 * invoice. Lines are deleted and recreated wholesale; the total is always
 * recomputed from the submitted lines (or overridden via `totalOverride`),
 * never trusted from a supplied total. Tasks previously attached to the
 * invoice are first detached back to PENDING_INVOICE, then the resolved set
 * (`taskIds` ∪ line `taskId`s) is re-attached scoped to
 * `{ userId, clientId }`, exactly like the HTTP route, so a task belonging
 * to another user or client can never be bound.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated full-replace payload for a DRAFT invoice.
 * @returns The updated draft summary, or an error result.
 */
export async function updateInvoiceDraft(
  userId: string,
  args: UpdateInvoiceDraftArgs,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "update_invoice_draft", args },
    async () => {
      if (args.kind === "DEPOSIT" && args.lines.length !== 1) {
        throw new McpToolError("A DEPOSIT invoice must have exactly one line")
      }
      const issueDate = parseIsoDate(args.issueDate, "issueDate")
      const dueDate = parseIsoDate(args.dueDate, "dueDate")

      const owned = await prisma.invoice.findFirst({
        where: { id: args.invoiceId, userId },
        select: { id: true, number: true, clientId: true, status: true },
      })
      if (!owned) throw mcpNotFound("Invoice")
      if (owned.status !== "DRAFT") {
        throw new McpToolError(
          "Only a DRAFT invoice can be edited with update_invoice_draft",
        )
      }

      if (args.number) {
        const conflict = await prisma.invoice.findFirst({
          where: {
            userId,
            number: args.number.trim(),
            NOT: { id: args.invoiceId },
          },
          select: { id: true },
        })
        if (conflict) {
          throw new McpToolError(
            `Invoice number "${args.number}" is already used`,
          )
        }
      }

      if (args.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: args.projectId, userId, clientId: owned.clientId },
          select: { id: true },
        })
        if (!project) {
          throw new McpToolError("Project not found for this client")
        }
      }

      const subtotal = args.lines.reduce((s, l) => s + l.qty * l.rate, 0)
      const total = args.totalOverride != null ? args.totalOverride : subtotal
      const number = args.number ? args.number.trim() : owned.number

      await prisma.$transaction(async (tx) => {
        await tx.task.updateMany({
          where: { invoiceId: args.invoiceId, userId },
          data: { invoiceId: null, status: "PENDING_INVOICE" },
        })

        await tx.invoiceLine.deleteMany({
          where: { invoiceId: args.invoiceId },
        })

        await tx.invoice.update({
          where: { id: args.invoiceId },
          data: {
            projectId: args.projectId ?? null,
            number,
            status: "DRAFT",
            kind: args.kind,
            issueDate,
            dueDate,
            subtotal,
            tax: 0,
            total,
            totalOverride: args.totalOverride ?? null,
            notes: args.notes ?? null,
            lines: {
              create: args.lines.map((l, i) => ({
                taskId: l.taskId ?? null,
                label: l.label,
                qty: l.qty,
                rate: l.rate,
                position: i,
              })),
            },
          },
        })

        const invoicedTaskIds = collectInvoicedTaskIds(args.taskIds, args.lines)
        if (invoicedTaskIds.length) {
          await tx.task.updateMany({
            where: {
              id: { in: invoicedTaskIds },
              userId,
              clientId: owned.clientId,
            },
            data: { invoiceId: args.invoiceId, status: "DONE" },
          })
        }

        await recomputeInvoicePayment(args.invoiceId, tx)
      })

      revalidateTag(invoicesTag(userId), "max")
      revalidateTag(navTag(userId), "max")

      return {
        id: args.invoiceId,
        number,
        status: "DRAFT" as const,
        clientId: owned.clientId,
        projectId: args.projectId ?? null,
        kind: args.kind,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        subtotal,
        total,
        linesCount: args.lines.length,
      }
    },
  )
}

/**
 * Handler for the split_invoice tool.
 *
 * Mirrors `POST /api/invoices/split`: allocates the contract total (`lines`
 * sum, or `totalOverride`) into `parts` installments with
 * `allocateSplitAmounts` for cent-exact allocation, then creates one DRAFT
 * invoice per installment with its own `subtotal`/`totalOverride` and a
 * `dueDate` shifted by `schedule`. Unlike the HTTP route — whose own TODO
 * documents the bug — every invoice number is allocated with
 * `nextAutoNumber(tx, …)` *inside* the same `$transaction`, interleaved one
 * number per created row: `nextAutoNumber` reads `tx.invoice.count`/
 * `findMany` under `pg_advisory_xact_lock`, so once installment N is
 * `tx.invoice.create`d, installment N+1's allocation call sees it via
 * read-your-own-writes and can never repeat a number, even under concurrent
 * split calls for the same user. Status is always DRAFT for every
 * installment — there is no `status` input — so this tool can never send an
 * invoice either. Tasks are attached to the FIRST installment only, scoped
 * to `{ userId, clientId }` like the other invoice-write tools (the HTTP
 * route only scopes by `userId`; this tool tightens that to match
 * `create_invoice_draft`/`update_invoice_draft`).
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated split payload.
 * @returns The created installments, or an error result.
 */
export async function splitInvoice(
  userId: string,
  args: SplitInvoiceArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "split_invoice", args }, async () => {
    if (args.kind === "DEPOSIT" && args.lines.length !== 1) {
      throw new McpToolError("A DEPOSIT invoice must have exactly one line")
    }

    const client = await prisma.client.findFirst({
      where: { id: args.clientId, userId },
      select: { id: true },
    })
    if (!client) throw mcpNotFound("Client")

    if (args.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: args.projectId, userId, clientId: args.clientId },
        select: { id: true },
      })
      if (!project) {
        throw new McpToolError("Project not found for this client")
      }
    }

    const issueDate = parseIsoDate(args.issueDate, "issueDate")
    const subtotal = args.lines.reduce((s, l) => s + l.qty * l.rate, 0)
    const baseTotal = args.totalOverride != null ? args.totalOverride : subtotal
    const partAmounts = allocateSplitAmounts(baseTotal, args.parts)
    const year = issueDate.getFullYear()

    const items = await prisma.$transaction(async (tx) => {
      const out: {
        id: string
        number: string
        total: number
        dueDate: string
      }[] = []

      for (let i = 0; i < args.parts; i++) {
        const isFirst = i === 0
        const partAmount = partAmounts[i] as number
        const dueDateStr = shiftSplitDate(args.dueDate, args.schedule, i)
        const partNote = `Acompte ${i + 1}/${args.parts} — total contractuel ${baseTotal}€`
        const number = await nextAutoNumber(tx, userId, year)
        const inv = await tx.invoice.create({
          data: {
            userId,
            clientId: args.clientId,
            projectId: args.projectId ?? null,
            number,
            status: "DRAFT",
            kind: args.kind,
            issueDate,
            dueDate: parseIsoDate(dueDateStr, "dueDate"),
            subtotal: partAmount,
            tax: 0,
            total: partAmount,
            totalOverride: partAmount,
            notes: args.notes ? `${partNote}\n${args.notes}` : partNote,
            lines: {
              create: args.lines.map((l, idx) => ({
                taskId: isFirst ? (l.taskId ?? null) : null,
                label: l.label,
                qty: l.qty,
                rate: l.rate,
                position: idx,
              })),
            },
          },
        })
        out.push({
          id: inv.id,
          number: inv.number,
          total: partAmount,
          dueDate: dueDateStr,
        })
      }

      const invoicedTaskIds = collectInvoicedTaskIds(args.taskIds, args.lines)
      if (invoicedTaskIds.length && out[0]) {
        await tx.task.updateMany({
          where: {
            id: { in: invoicedTaskIds },
            userId,
            clientId: args.clientId,
          },
          data: { invoiceId: out[0].id, status: "DONE" },
        })
      }

      return out
    })

    revalidateTag(invoicesTag(userId), "max")
    revalidateTag(navTag(userId), "max")

    return { items }
  })
}

/**
 * Handler for the record_payment tool.
 *
 * Mirrors `POST /api/invoices/[id]/payments`: refuses with an `isError`
 * result on a CANCELLED invoice, then creates the `Payment` row and calls
 * `recomputeInvoicePayment` inside the same transaction — that function is
 * the single holder of the paid/partial/overpaid invariant, so the cached
 * `paymentStatus` can never drift from the sum of payments. There is
 * deliberately no amount cap: the human operator's confirmation prompt in
 * the MCP client is the guard, not this tool. Returns the resulting
 * `balanceDue` so the caller can state what is left to pay without a
 * follow-up `get_invoice` call.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated payment payload, reusing `paymentCreateSchema`.
 * @returns The recorded payment plus the invoice's new balance, or an error
 *   result.
 */
export async function recordPayment(
  userId: string,
  args: RecordPaymentArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "record_payment", args }, async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { id: args.invoiceId, userId },
      select: { id: true, status: true, number: true, clientId: true },
    })
    if (!invoice) throw mcpNotFound("Invoice")
    if (invoice.status === "CANCELLED") {
      throw new McpToolError("Cannot record a payment on a cancelled invoice")
    }

    const paidAt = parseIsoDate(args.paidAt, "paidAt")

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId,
          invoiceId: args.invoiceId,
          amount: args.amount,
          paidAt,
          method: args.method ?? null,
          note: args.note ?? null,
        },
      })
      const paymentStatus = await recomputeInvoicePayment(args.invoiceId, tx)
      const [sum, invoiceRow] = await Promise.all([
        tx.payment.aggregate({
          where: { invoiceId: args.invoiceId },
          _sum: { amount: true },
        }),
        tx.invoice.findUniqueOrThrow({
          where: { id: args.invoiceId },
          select: { total: true },
        }),
      ])
      const balanceDue =
        (decimalToNumber(invoiceRow.total) ?? 0) -
        (decimalToNumber(sum._sum.amount) ?? 0)
      return { payment, paymentStatus, balanceDue }
    })

    revalidateTag(invoicesTag(userId), "max")
    revalidateTag(navTag(userId), "max")
    deferActivityLog({
      userId,
      kind: "PAYMENT_RECORDED",
      title: `Paiement de ${args.amount.toFixed(2)} € sur ${invoice.number}`,
      meta: args.method ?? undefined,
      clientId: invoice.clientId,
      invoiceId: invoice.id,
    })

    return {
      id: result.payment.id,
      invoiceId: args.invoiceId,
      amount: decimalToNumber(result.payment.amount) ?? 0,
      paidAt: result.payment.paidAt.toISOString(),
      paymentStatus: result.paymentStatus,
      balanceDue: result.balanceDue,
    }
  })
}

/**
 * Register the money-touching invoice write tools on the given MCP server
 * for one principal: `update_invoice_draft`, `split_invoice`,
 * `record_payment`. Split out from `registerInvoiceTools` (in `invoices.ts`)
 * purely to keep each file under the project's line-count budget; both are
 * called together from `registerMcpTools`.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerInvoiceWriteTools(
  server: McpServer,
  userId: string,
): void {
  server.registerTool(
    "update_invoice_draft",
    {
      description:
        "Full-replace edit of an invoice that is still DRAFT (lines, dates, kind, notes, totalOverride, attached tasks). Refuses any invoice not currently DRAFT. The status written back is always DRAFT and the total is always recomputed from the lines — this tool can never send an invoice, and repeating the same call leaves the same state.",
      inputSchema: updateInvoiceDraftInput,
      outputSchema: updateInvoiceDraftOutput,
      annotations: writeAnnotations(true),
    },
    (args) => updateInvoiceDraft(userId, args),
  )
  server.registerTool(
    "split_invoice",
    {
      description:
        "Split a contract total into `parts` DRAFT installments with cent-exact amounts and dueDates shifted by `schedule`. Every invoice number is allocated inside the same transaction, so concurrent splits can never collide. Status is always DRAFT for every installment — this tool can never send an invoice. Not idempotent: repeating the call creates new installments.",
      inputSchema: splitInvoiceInput,
      outputSchema: splitInvoiceOutput,
      annotations: writeAnnotations(false),
    },
    (args) => splitInvoice(userId, args),
  )
  server.registerTool(
    "record_payment",
    {
      description:
        "Record a payment against an invoice (refused on a CANCELLED invoice). Recomputes the invoice's paid/partial/overpaid status atomically and returns the new balanceDue. There is no amount cap — the calling operator's own confirmation is the guard. Not idempotent: repeating the call records another payment.",
      inputSchema: recordPaymentInput,
      outputSchema: recordPaymentOutput,
      annotations: writeAnnotations(false),
    },
    (args) => recordPayment(userId, args),
  )
}
