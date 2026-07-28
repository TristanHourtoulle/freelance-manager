import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { buildPagedResponse, decimalToNumber } from "@/lib/api"
import {
  CAPPED_LIST_NOTE,
  cursorInputSchema,
  limitInputSchema,
  mcpNotFound,
  NAME_MAX_CHARS,
  NOTE_MAX_CHARS,
  pagedOutputSchema,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  truncateNullableText,
  truncateText,
} from "@/lib/mcp/tools/common"

const listClientsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  includeArchived: z
    .boolean()
    .default(false)
    .describe("Include archived clients"),
})

const clientRowSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  company: z.string().nullable(),
  billingMode: z.enum(["DAILY", "FIXED", "HOURLY"]),
  rate: z.number(),
  category: z.enum(["FREELANCE", "STUDY", "PERSONAL", "SIDE_PROJECT"]),
  stage: z.enum(["LEAD", "ACTIVE", "DORMANT"]),
  starred: z.boolean(),
  archived: z.boolean(),
  createdAt: z.string(),
})

const listClientsOutput = pagedOutputSchema(clientRowSchema)

const getClientInput = z.object({
  clientId: z.string().min(1),
})

const getClientOutput = clientRowSchema.extend({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  paymentTerms: z.number().nullable(),
  fixedPrice: z.number().nullable(),
  deposit: z.number().nullable(),
  notes: z.string().nullable(),
})

type ListClientsArgs = z.output<typeof listClientsInput>
type GetClientArgs = z.output<typeof getClientInput>

const CLIENT_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  company: true,
  billingMode: true,
  rate: true,
  category: true,
  stage: true,
  starred: true,
  archivedAt: true,
  createdAt: true,
} as const

/**
 * Handler for the list_clients tool: capped, userId-scoped client page.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and archive-filter arguments.
 * @returns One page of client rows with names truncated.
 */
export async function listClients(
  userId: string,
  args: ListClientsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_clients", args }, async () => {
    const rows = await prisma.client.findMany({
      where: { userId, ...(args.includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: CLIENT_LIST_SELECT,
    })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data.map((c) => ({
        id: c.id,
        firstName: truncateText(c.firstName, NAME_MAX_CHARS),
        lastName: truncateText(c.lastName, NAME_MAX_CHARS),
        company: truncateNullableText(c.company, NAME_MAX_CHARS),
        billingMode: c.billingMode,
        rate: decimalToNumber(c.rate) ?? 0,
        category: c.category,
        stage: c.stage,
        starred: c.starred,
        archived: c.archivedAt != null,
        createdAt: c.createdAt.toISOString(),
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  })
}

/**
 * Handler for the get_client tool: one client owned by the principal.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated arguments carrying the client id.
 * @returns The client detail, or a not-found error result.
 */
export async function getClient(
  userId: string,
  args: GetClientArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "get_client", args }, async () => {
    const c = await prisma.client.findFirst({
      where: { id: args.clientId, userId },
      select: {
        ...CLIENT_LIST_SELECT,
        email: true,
        phone: true,
        paymentTerms: true,
        fixedPrice: true,
        deposit: true,
        notes: true,
      },
    })
    if (!c) throw mcpNotFound("Client")
    return {
      id: c.id,
      firstName: truncateText(c.firstName, NAME_MAX_CHARS),
      lastName: truncateText(c.lastName, NAME_MAX_CHARS),
      company: truncateNullableText(c.company, NAME_MAX_CHARS),
      billingMode: c.billingMode,
      rate: decimalToNumber(c.rate) ?? 0,
      category: c.category,
      stage: c.stage,
      starred: c.starred,
      archived: c.archivedAt != null,
      createdAt: c.createdAt.toISOString(),
      email: truncateNullableText(c.email, NAME_MAX_CHARS),
      phone: truncateNullableText(c.phone, NAME_MAX_CHARS),
      paymentTerms: c.paymentTerms,
      fixedPrice: decimalToNumber(c.fixedPrice),
      deposit: decimalToNumber(c.deposit),
      notes: truncateNullableText(c.notes, NOTE_MAX_CHARS),
    }
  })
}

/**
 * Register the client read tools on the given MCP server for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerClientTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_clients",
    {
      description: `List the user's clients (billing mode, rate, category, stage). ${CAPPED_LIST_NOTE}`,
      inputSchema: listClientsInput,
      outputSchema: listClientsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listClients(userId, args),
  )
  server.registerTool(
    "get_client",
    {
      description:
        "Get one client by id, including contact fields, payment terms and truncated notes.",
      inputSchema: getClientInput,
      outputSchema: getClientOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => getClient(userId, args),
  )
}
