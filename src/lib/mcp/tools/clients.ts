import "server-only"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { clientCreateSchema, clientUpdateSchema } from "@/lib/schemas/client"
import { linearMappingCreateSchema } from "@/lib/schemas/linear-mapping"
import { deferActivityLog } from "@/lib/activity"
import { clientsTag } from "@/lib/data/clients"
import { projectsTag } from "@/lib/data/projects"
import { navTag } from "@/lib/data/nav"
import {
  cursorInputSchema,
  fetchAllInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NAME_MAX_CHARS,
  NOTE_MAX_CHARS,
  PAGINATED_LIST_NOTE,
  paginatedOutputSchema,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const listClientsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  fetchAll: fetchAllInputSchema,
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

const listClientsOutput = paginatedOutputSchema(clientRowSchema)

const getClientInput = z.object({
  clientId: z.string().min(1),
})

const clientDetailSchema = clientRowSchema.extend({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  paymentTerms: z.number().nullable(),
  fixedPrice: z.number().nullable(),
  deposit: z.number().nullable(),
  notes: z.string().nullable(),
})

const getClientOutput = clientDetailSchema
const createClientOutput = clientDetailSchema
const updateClientOutput = clientDetailSchema

const updateClientInput = clientUpdateSchema.extend({
  clientId: z.string().min(1),
})

const linkLinearProjectInput = linearMappingCreateSchema

const linkLinearProjectOutput = z.object({
  id: z.string(),
  clientId: z.string(),
  linearTeamId: z.string().nullable(),
  linearProjectId: z.string().nullable(),
  createdAt: z.string(),
})

type ListClientsArgs = z.output<typeof listClientsInput>
type GetClientArgs = z.output<typeof getClientInput>
type CreateClientArgs = z.output<typeof clientCreateSchema>
type UpdateClientArgs = z.output<typeof updateClientInput>
type LinkLinearProjectArgs = z.output<typeof linkLinearProjectInput>

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

const CLIENT_DETAIL_SELECT = {
  ...CLIENT_LIST_SELECT,
  email: true,
  phone: true,
  paymentTerms: true,
  fixedPrice: true,
  deposit: true,
  notes: true,
} as const

type ClientListRow = Prisma.ClientGetPayload<{
  select: typeof CLIENT_LIST_SELECT
}>
type ClientDetailRow = Prisma.ClientGetPayload<{
  select: typeof CLIENT_DETAIL_SELECT
}>

/**
 * Project a Client row onto the bounded list-tool output shape, truncating
 * free text and normalizing Decimal fields to plain numbers.
 *
 * @param c - The Client row selected via {@link CLIENT_LIST_SELECT}.
 * @returns The list-tool row.
 */
function toClientRow(c: ClientListRow) {
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
  }
}

/**
 * Project a Client row onto the detail-tool output shape (list fields plus
 * contact info, billing extras and truncated notes).
 *
 * @param c - The Client row selected via {@link CLIENT_DETAIL_SELECT}.
 * @returns The detail-tool row.
 */
function toClientDetail(c: ClientDetailRow) {
  return {
    ...toClientRow(c),
    email: truncateNullableText(c.email, NAME_MAX_CHARS),
    phone: truncateNullableText(c.phone, NAME_MAX_CHARS),
    paymentTerms: c.paymentTerms,
    fixedPrice: decimalToNumber(c.fixedPrice),
    deposit: decimalToNumber(c.deposit),
    notes: truncateNullableText(c.notes, NOTE_MAX_CHARS),
  }
}

/**
 * Handler for the list_clients tool: v2-paginated, userId-scoped client page
 * with an uncapped `total` and optional server-side `fetchAll` walk.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and archive-filter arguments.
 * @returns One page (or the full walked set) of client rows.
 */
export async function listClients(
  userId: string,
  args: ListClientsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_clients", args }, async () => {
    const where = {
      userId,
      ...(args.includeArchived ? {} : { archivedAt: null }),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.client.count({ where }),
      page: ({ cursor, take }) =>
        prisma.client.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: CLIENT_LIST_SELECT,
        }),
    })
    return {
      data: result.data.map(toClientRow),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
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
      select: CLIENT_DETAIL_SELECT,
    })
    if (!c) throw mcpNotFound("Client")
    return toClientDetail(c)
  })
}

/**
 * Handler for the create_client tool, mirroring `POST /api/clients`: same
 * defaults, the same `clientsTag`/`navTag` invalidation and the same
 * `CLIENT_CREATED` activity log entry.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated client payload (`clientCreateSchema`, including
 *   its FIXED-billing `superRefine`).
 * @returns The created client detail.
 */
export async function createClient(
  userId: string,
  args: CreateClientArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "create_client", args }, async () => {
    const created = await prisma.client.create({
      data: {
        userId,
        firstName: args.firstName,
        lastName: args.lastName,
        company: args.company ?? null,
        email: args.email ?? null,
        phone: args.phone ?? null,
        website: args.website ?? null,
        address: args.address ?? null,
        notes: args.notes ?? null,
        billingMode: args.billingMode ?? "DAILY",
        rate: args.rate ?? 0,
        fixedPrice: args.fixedPrice ?? null,
        deposit: args.deposit ?? null,
        paymentTerms: args.paymentTerms ?? null,
        category: args.category ?? "FREELANCE",
        stage: args.stage ?? "ACTIVE",
        color: args.color ?? null,
        starred: args.starred ?? false,
      },
      select: CLIENT_DETAIL_SELECT,
    })
    revalidateTag(clientsTag(userId), "max")
    revalidateTag(navTag(userId), "max")
    deferActivityLog({
      userId,
      kind: "CLIENT_CREATED",
      title: `Client ${created.company ?? `${created.firstName} ${created.lastName}`} créé`,
      clientId: created.id,
    })
    return toClientDetail(created)
  })
}

/**
 * Handler for the update_client tool, mirroring `PATCH /api/clients/[id]`:
 * only fields present in the input are patched, the client is scoped by
 * `{id, userId}` so a foreign id is a not-found error, and the same
 * `clientsTag` invalidation and `CLIENT_UPDATED` activity log entry apply.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated partial client payload plus the target `clientId`.
 * @returns The updated client detail, or a not-found error result.
 */
export async function updateClient(
  userId: string,
  args: UpdateClientArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "update_client", args }, async () => {
    const { clientId, ...data } = args
    const owned = await prisma.client.findFirst({
      where: { id: clientId, userId },
      select: { id: true, firstName: true, lastName: true, company: true },
    })
    if (!owned) throw mcpNotFound("Client")

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...("firstName" in data ? { firstName: data.firstName } : {}),
        ...("lastName" in data ? { lastName: data.lastName } : {}),
        ...("company" in data ? { company: data.company ?? null } : {}),
        ...("email" in data ? { email: data.email ?? null } : {}),
        ...("phone" in data ? { phone: data.phone ?? null } : {}),
        ...("website" in data ? { website: data.website ?? null } : {}),
        ...("address" in data ? { address: data.address ?? null } : {}),
        ...("notes" in data ? { notes: data.notes ?? null } : {}),
        ...("billingMode" in data ? { billingMode: data.billingMode } : {}),
        ...("rate" in data ? { rate: data.rate } : {}),
        ...("fixedPrice" in data
          ? { fixedPrice: data.fixedPrice ?? null }
          : {}),
        ...("deposit" in data ? { deposit: data.deposit ?? null } : {}),
        ...("paymentTerms" in data
          ? { paymentTerms: data.paymentTerms ?? null }
          : {}),
        ...("category" in data ? { category: data.category } : {}),
        ...("color" in data ? { color: data.color ?? null } : {}),
        ...("starred" in data ? { starred: data.starred } : {}),
      },
      select: CLIENT_DETAIL_SELECT,
    })
    revalidateTag(clientsTag(userId), "max")
    deferActivityLog({
      userId,
      kind: "CLIENT_UPDATED",
      title: `Client ${owned.company ?? `${owned.firstName} ${owned.lastName}`} mis à jour`,
      clientId,
    })
    return toClientDetail(updated)
  })
}

/**
 * Handler for the link_linear_project tool, mirroring
 * `POST /api/clients/[id]/linear-mappings`: 409-shaped as an `McpToolError`
 * when the Linear project is already linked to a different client of this
 * principal, and idempotent (returns the existing row instead of a
 * duplicate) when the exact same client/project or client/team pair is
 * resubmitted. Deliberately does NOT call `syncOneProject` — creating a
 * mapping only registers the link; pulling Linear tasks/status into this
 * app remains a separate, heavier, user-triggered sync.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated mapping payload (`linearMappingCreateSchema`):
 *   a `clientId` plus at least one of `linearTeamId` / `linearProjectId`.
 * @returns The created (or pre-existing) mapping, or an error result.
 */
export async function linkLinearProject(
  userId: string,
  args: LinkLinearProjectArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "link_linear_project", args }, async () => {
    const owned = await prisma.client.findFirst({
      where: { id: args.clientId, userId },
      select: { id: true },
    })
    if (!owned) throw mcpNotFound("Client")

    const mappingSelect = {
      id: true,
      clientId: true,
      linearTeamId: true,
      linearProjectId: true,
      createdAt: true,
    } as const

    if (args.linearProjectId) {
      const existing = await prisma.linearMapping.findFirst({
        where: {
          linearProjectId: args.linearProjectId,
          client: { userId },
        },
        select: {
          ...mappingSelect,
          client: {
            select: { firstName: true, lastName: true, company: true },
          },
        },
      })
      if (existing && existing.clientId !== args.clientId) {
        const label =
          existing.client.company ??
          `${existing.client.firstName} ${existing.client.lastName}`
        throw new McpToolError(
          `This Linear project is already linked to client ${label} (${existing.clientId})`,
        )
      }
      if (existing) {
        return {
          id: existing.id,
          clientId: existing.clientId,
          linearTeamId: existing.linearTeamId,
          linearProjectId: existing.linearProjectId,
          createdAt: existing.createdAt.toISOString(),
        }
      }
    }

    if (args.linearTeamId) {
      const existingTeam = await prisma.linearMapping.findFirst({
        where: { clientId: args.clientId, linearTeamId: args.linearTeamId },
        select: mappingSelect,
      })
      if (existingTeam) {
        return {
          id: existingTeam.id,
          clientId: existingTeam.clientId,
          linearTeamId: existingTeam.linearTeamId,
          linearProjectId: existingTeam.linearProjectId,
          createdAt: existingTeam.createdAt.toISOString(),
        }
      }
    }

    const created = await prisma.linearMapping.create({
      data: {
        clientId: args.clientId,
        linearTeamId: args.linearTeamId ?? null,
        linearProjectId: args.linearProjectId ?? null,
      },
    })
    revalidateTag(projectsTag(userId), "max")
    revalidateTag(navTag(userId), "max")
    return {
      id: created.id,
      clientId: created.clientId,
      linearTeamId: created.linearTeamId,
      linearProjectId: created.linearProjectId,
      createdAt: created.createdAt.toISOString(),
    }
  })
}

/**
 * Register the client tools on the given MCP server for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerClientTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_clients",
    {
      description: `List the user's clients (billing mode, rate, category, stage). ${PAGINATED_LIST_NOTE}`,
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
  server.registerTool(
    "create_client",
    {
      description:
        "Create a new client. FIXED billing mode requires a positive fixedPrice.",
      inputSchema: clientCreateSchema,
      outputSchema: createClientOutput,
      annotations: writeAnnotations(false),
    },
    (args) => createClient(userId, args),
  )
  server.registerTool(
    "update_client",
    {
      description:
        "Patch a client by id — only the fields present in the call are changed. A foreign or unknown clientId returns a not-found error, never another user's data.",
      inputSchema: updateClientInput,
      outputSchema: updateClientOutput,
      annotations: writeAnnotations(true),
    },
    (args) => updateClient(userId, args),
  )
  server.registerTool(
    "link_linear_project",
    {
      description:
        "Link a client to a Linear team or project id (at least one required), so future Linear syncs know which client owns it. Does NOT trigger a Linear sync itself — task/project data is not pulled in by this call; use the app's manual Sync Linear action for that. Fails when the Linear project is already linked to a different client.",
      inputSchema: linkLinearProjectInput,
      outputSchema: linkLinearProjectOutput,
      annotations: writeAnnotations(true),
    },
    (args) => linkLinearProject(userId, args),
  )
}
