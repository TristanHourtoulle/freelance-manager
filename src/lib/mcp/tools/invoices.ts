import "server-only"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { serializeInvoice } from "@/domain/billing/serialize"
import type { InvoiceRowForSerialize } from "@/domain/billing/serialize"
import { collectInvoicedTaskIds } from "@/domain/billing/invoiced-tasks"
import { nextAutoNumber } from "@/lib/invoice-numbering"
import { invoicesTag } from "@/lib/data/invoices"
import { clientsTag } from "@/lib/data/clients"
import { navTag } from "@/lib/data/nav"
import { deferActivityLog } from "@/lib/activity"
import {
  cursorInputSchema,
  fetchAllInputSchema,
  isoDateInputSchema,
  LABEL_MAX_CHARS,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NOTE_MAX_CHARS,
  paginatedOutputSchema,
  PAGINATED_LIST_NOTE,
  parseIsoDate,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

/**
 * Shared invoice-domain schemas. Exported for `invoices-write.ts`
 * (`update_invoice_draft` / `split_invoice` / `record_payment`), which is
 * split out from this file purely to keep both under the project's
 * line-count budget — the two files together form one tool surface,
 * registered as a pair from `registerMcpTools`.
 */
export const invoiceKindSchema = z.enum(["STANDARD", "DEPOSIT"])
export const paymentStatusSchema = z.enum([
  "UNPAID",
  "PARTIALLY_PAID",
  "PAID",
  "OVERPAID",
])
export const draftLineInputSchema = z.object({
  taskId: z.string().min(1).optional(),
  label: z.string().min(1).max(240),
  qty: z.number().min(0).max(100_000),
  rate: z.number().min(0).max(10_000_000),
})

const invoiceStatusSchema = z.enum(["DRAFT", "SENT", "CANCELLED"])

const listInvoicesInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  fetchAll: fetchAllInputSchema,
  status: invoiceStatusSchema.optional(),
  clientId: z.string().min(1).optional(),
})

const invoiceRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  clientId: z.string(),
  projectId: z.string().nullable(),
  status: invoiceStatusSchema,
  paymentStatus: paymentStatusSchema,
  isOverdue: z.boolean(),
  kind: invoiceKindSchema,
  issueDate: z.string(),
  dueDate: z.string(),
  paidAmount: z.number(),
  balanceDue: z.number(),
  subtotal: z.number(),
  total: z.number(),
  notes: z.string().nullable(),
  linesCount: z.number(),
})

const listInvoicesOutput = paginatedOutputSchema(invoiceRowSchema)

const getInvoiceInput = z.object({
  invoiceId: z.string().min(1),
})

const invoiceLineSchema = z.object({
  id: z.string(),
  taskId: z.string().nullable(),
  label: z.string(),
  qty: z.number(),
  rate: z.number(),
})

const getInvoiceOutput = invoiceRowSchema.extend({
  lines: z.array(invoiceLineSchema),
})

const createInvoiceDraftInput = z.object({
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
    .describe("Extra task ids to attach to the invoice"),
})

const createInvoiceDraftOutput = z.object({
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

type ListInvoicesArgs = z.output<typeof listInvoicesInput>
type GetInvoiceArgs = z.output<typeof getInvoiceInput>
type CreateInvoiceDraftArgs = z.output<typeof createInvoiceDraftInput>

function toInvoiceRow(row: InvoiceRowForSerialize) {
  const inv = serializeInvoice(row)
  return {
    id: inv.id,
    number: inv.number,
    clientId: inv.clientId,
    projectId: inv.projectId,
    status: inv.status,
    paymentStatus: inv.paymentStatus,
    isOverdue: inv.isOverdue,
    kind: inv.kind,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    subtotal: inv.subtotal,
    total: inv.total,
    notes: truncateNullableText(inv.notes, NOTE_MAX_CHARS),
    linesCount: inv.linesCount,
  }
}

const INVOICE_INCLUDE = {
  _count: { select: { lines: true } },
  payments: { select: { amount: true, paidAt: true } },
} as const

/**
 * Handler for the list_invoices tool: userId-scoped invoice page on the v2
 * pagination contract (uncapped `total`, optional `fetchAll`).
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page of invoice rows built by the canonical serializer.
 */
export async function listInvoices(
  userId: string,
  args: ListInvoicesArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_invoices", args }, async () => {
    const where = {
      userId,
      ...(args.status ? { status: args.status } : {}),
      ...(args.clientId ? { clientId: args.clientId } : {}),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.invoice.count({ where }),
      page: ({ cursor, take }) =>
        prisma.invoice.findMany({
          where,
          orderBy: [{ issueDate: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: INVOICE_INCLUDE,
        }),
    })
    return {
      data: result.data.map(toInvoiceRow),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
    }
  })
}

/**
 * Handler for the get_invoice tool: one invoice with its lines.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated arguments carrying the invoice id.
 * @returns The invoice detail, or a not-found error result.
 */
export async function getInvoice(
  userId: string,
  args: GetInvoiceArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "get_invoice", args }, async () => {
    const row = await prisma.invoice.findFirst({
      where: { id: args.invoiceId, userId },
      include: {
        ...INVOICE_INCLUDE,
        lines: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            taskId: true,
            label: true,
            qty: true,
            rate: true,
          },
        },
      },
    })
    if (!row) throw mcpNotFound("Invoice")
    return {
      ...toInvoiceRow(row),
      lines: row.lines.map((l) => ({
        id: l.id,
        taskId: l.taskId,
        label: truncateText(l.label, LABEL_MAX_CHARS),
        qty: decimalToNumber(l.qty) ?? 0,
        rate: decimalToNumber(l.rate) ?? 0,
      })),
    }
  })
}

/**
 * Handler for the create_invoice_draft tool.
 *
 * Authority limits enforced server-side, whatever the model sends:
 * the status is always DRAFT, the total is always computed from the lines,
 * and the invoice number is always allocated by `nextAutoNumber` inside the
 * same transaction (its advisory lock only serializes in-transaction).
 * Attached tasks are updated with a `{ userId, clientId }` scope so a task
 * belonging to another user or client can never be bound. DEPOSIT invoices
 * must carry exactly one line, mirroring the HTTP schema invariant.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated draft payload.
 * @returns The created draft summary, or an error result.
 */
export async function createInvoiceDraft(
  userId: string,
  args: CreateInvoiceDraftArgs,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "create_invoice_draft", args },
    async () => {
      if (args.kind === "DEPOSIT" && args.lines.length !== 1) {
        throw new McpToolError("A DEPOSIT invoice must have exactly one line")
      }
      const issueDate = parseIsoDate(args.issueDate, "issueDate")
      const dueDate = parseIsoDate(args.dueDate, "dueDate")

      const client = await prisma.client.findFirst({
        where: { id: args.clientId, userId },
        select: { id: true, stage: true },
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

      const subtotal = args.lines.reduce((s, l) => s + l.qty * l.rate, 0)

      const created = await prisma.$transaction(async (tx) => {
        const number = await nextAutoNumber(tx, userId, issueDate.getFullYear())
        const inv = await tx.invoice.create({
          data: {
            userId,
            clientId: args.clientId,
            projectId: args.projectId ?? null,
            number,
            status: "DRAFT",
            kind: args.kind,
            issueDate,
            dueDate,
            subtotal,
            tax: 0,
            total: subtotal,
            totalOverride: null,
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
              clientId: args.clientId,
            },
            data: { invoiceId: inv.id, status: "DONE" },
          })
        }

        if (client.stage === "LEAD") {
          await tx.client.update({
            where: { id: client.id },
            data: { stage: "ACTIVE" },
          })
        }

        return inv
      })

      revalidateTag(invoicesTag(userId), "max")
      revalidateTag(clientsTag(userId), "max")
      revalidateTag(navTag(userId), "max")
      deferActivityLog({
        userId,
        kind: "INVOICE_CREATED",
        title: `Brouillon ${created.number} créé`,
        meta: `${subtotal.toFixed(2)} €`,
        clientId: created.clientId,
        invoiceId: created.id,
        projectId: created.projectId,
      })

      return {
        id: created.id,
        number: created.number,
        status: "DRAFT" as const,
        clientId: created.clientId,
        projectId: created.projectId,
        kind: args.kind,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        subtotal,
        total: subtotal,
        linesCount: args.lines.length,
      }
    },
  )
}

/**
 * Register the read tools and `create_invoice_draft` on the given MCP
 * server for one principal. `update_invoice_draft`, `split_invoice` and
 * `record_payment` are registered separately by
 * `registerInvoiceWriteTools` in `invoices-write.ts`.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerInvoiceTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_invoices",
    {
      description: `List the user's invoices with payment state. Filters: status, clientId. ${PAGINATED_LIST_NOTE}`,
      inputSchema: listInvoicesInput,
      outputSchema: listInvoicesOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listInvoices(userId, args),
  )
  server.registerTool(
    "get_invoice",
    {
      description: "Get one invoice by id, including its lines.",
      inputSchema: getInvoiceInput,
      outputSchema: getInvoiceOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => getInvoice(userId, args),
  )
  server.registerTool(
    "create_invoice_draft",
    {
      description:
        "Create a DRAFT invoice for a client. The status is always DRAFT, the total is always computed from the lines, and the number is auto-allocated — this tool can never send an invoice.",
      inputSchema: createInvoiceDraftInput,
      outputSchema: createInvoiceDraftOutput,
      annotations: writeAnnotations(false),
    },
    (args) => createInvoiceDraft(userId, args),
  )
}
