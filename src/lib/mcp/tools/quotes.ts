import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { buildPagedResponse } from "@/lib/api"
import { serializeQuote } from "@/domain/quotes/serialize"
import {
  CAPPED_LIST_NOTE,
  cursorInputSchema,
  limitInputSchema,
  NOTE_MAX_CHARS,
  pagedOutputSchema,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  truncateNullableText,
} from "@/lib/mcp/tools/common"

const quoteStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REFUSED",
  "EXPIRED",
])

const listQuotesInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  status: quoteStatusSchema.optional(),
  clientId: z.string().min(1).optional(),
})

const quoteRowSchema = z.object({
  id: z.string(),
  number: z.string(),
  clientId: z.string(),
  projectId: z.string().nullable(),
  status: quoteStatusSchema,
  issueDate: z.string(),
  validUntil: z.string().nullable(),
  sentAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
  subtotal: z.number(),
  total: z.number(),
  notes: z.string().nullable(),
  linesCount: z.number(),
  createdAt: z.string(),
})

const listQuotesOutput = pagedOutputSchema(quoteRowSchema)

type ListQuotesArgs = z.output<typeof listQuotesInput>

/**
 * Handler for the list_quotes tool: capped, userId-scoped quote page.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page of quote rows with notes truncated.
 */
export async function listQuotes(
  userId: string,
  args: ListQuotesArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_quotes", args }, async () => {
    const rows = await prisma.quote.findMany({
      where: {
        userId,
        ...(args.status ? { status: args.status } : {}),
        ...(args.clientId ? { clientId: args.clientId } : {}),
      },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      include: { _count: { select: { lines: true } } },
    })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data.map((row) => {
        const q = serializeQuote(row)
        return {
          id: q.id,
          number: q.number,
          clientId: q.clientId,
          projectId: q.projectId,
          status: q.status,
          issueDate: q.issueDate,
          validUntil: q.validUntil,
          sentAt: q.sentAt,
          decidedAt: q.decidedAt,
          subtotal: q.subtotal,
          total: q.total,
          notes: truncateNullableText(q.notes, NOTE_MAX_CHARS),
          linesCount: q.linesCount,
          createdAt: q.createdAt,
        }
      }),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  })
}

/**
 * Register the quote read tool on the given MCP server for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerQuoteTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_quotes",
    {
      description: `List the user's quotes (status, totals, decision dates). Filters: status, clientId. ${CAPPED_LIST_NOTE}`,
      inputSchema: listQuotesInput,
      outputSchema: listQuotesOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listQuotes(userId, args),
  )
}
