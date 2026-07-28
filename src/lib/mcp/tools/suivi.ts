import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { buildPagedResponse } from "@/lib/api"
import { deferActivityLog } from "@/lib/activity"
import {
  clientActionStatusSchema,
  clientActionTypeSchema,
} from "@/lib/schemas/action"
import {
  CAPPED_LIST_NOTE,
  cursorInputSchema,
  isoDateInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NAME_MAX_CHARS,
  NOTE_MAX_CHARS,
  pagedOutputSchema,
  parseIsoDate,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  TITLE_MAX_CHARS,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const listMeetingsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  clientId: z.string().min(1).optional(),
})

const meetingRowSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string(),
  heldAt: z.string(),
  durationMinutes: z.number(),
  participants: z.array(z.string()),
  agenda: z.string().nullable(),
  summary: z.string().nullable(),
  actionsCount: z.number(),
})

const listMeetingsOutput = pagedOutputSchema(meetingRowSchema)

const listActionsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  clientId: z.string().min(1).optional(),
  status: clientActionStatusSchema.optional(),
  type: clientActionTypeSchema.optional(),
})

const actionRowSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  type: clientActionTypeSchema,
  title: z.string(),
  link: z.string().nullable(),
  notes: z.string().nullable(),
  status: clientActionStatusSchema,
  dueDate: z.string().nullable(),
  doneAt: z.string().nullable(),
  invoiceId: z.string().nullable(),
  meetingId: z.string().nullable(),
  createdAt: z.string(),
})

const listActionsOutput = pagedOutputSchema(actionRowSchema)

const logMeetingInput = z.object({
  clientId: z.string().min(1),
  title: z.string().min(1).max(200),
  heldAt: isoDateInputSchema.describe("When the meeting took place"),
  durationMinutes: z.number().int().min(0).max(100_000).default(0),
  participants: z.array(z.string().min(1).max(160)).max(50).default([]),
  teamsUrl: z.string().max(2000).optional(),
  agendaMd: z.string().max(20_000).optional(),
  summaryMd: z.string().max(20_000).optional(),
})

const logMeetingOutput = z.object({
  id: z.string(),
  clientId: z.string(),
  title: z.string(),
  heldAt: z.string(),
  durationMinutes: z.number(),
  createdAt: z.string(),
})

const createActionInput = z.object({
  clientId: z.string().min(1).optional(),
  type: clientActionTypeSchema.default("OTHER"),
  title: z.string().min(1).max(200),
  link: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  dueDate: isoDateInputSchema.optional(),
  invoiceId: z.string().min(1).optional(),
  meetingId: z.string().min(1).optional(),
})

const createActionOutput = z.object({
  id: z.string(),
  clientId: z.string().nullable(),
  type: clientActionTypeSchema,
  title: z.string(),
  status: clientActionStatusSchema,
  dueDate: z.string().nullable(),
  invoiceId: z.string().nullable(),
  meetingId: z.string().nullable(),
  createdAt: z.string(),
})

type ListMeetingsArgs = z.output<typeof listMeetingsInput>
type ListActionsArgs = z.output<typeof listActionsInput>
type LogMeetingArgs = z.output<typeof logMeetingInput>
type CreateActionArgs = z.output<typeof createActionInput>

/**
 * Handler for the list_meetings tool: capped, userId-scoped meeting page.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page of meeting rows with free text truncated.
 */
export async function listMeetings(
  userId: string,
  args: ListMeetingsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_meetings", args }, async () => {
    const rows = await prisma.meeting.findMany({
      where: { userId, ...(args.clientId ? { clientId: args.clientId } : {}) },
      orderBy: [{ heldAt: "desc" }, { id: "desc" }],
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        clientId: true,
        title: true,
        heldAt: true,
        durationMinutes: true,
        participants: true,
        agendaMd: true,
        summaryMd: true,
        _count: { select: { actions: true } },
      },
    })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data.map((m) => ({
        id: m.id,
        clientId: m.clientId,
        title: truncateText(m.title, TITLE_MAX_CHARS),
        heldAt: m.heldAt.toISOString(),
        durationMinutes: m.durationMinutes,
        participants: m.participants.map((p) =>
          truncateText(p, NAME_MAX_CHARS),
        ),
        agenda: truncateNullableText(m.agendaMd, NOTE_MAX_CHARS),
        summary: truncateNullableText(m.summaryMd, NOTE_MAX_CHARS),
        actionsCount: m._count.actions,
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  })
}

/**
 * Handler for the list_actions tool: capped, userId-scoped follow-up actions.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page of action rows with free text truncated.
 */
export async function listActions(
  userId: string,
  args: ListActionsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_actions", args }, async () => {
    const rows = await prisma.clientAction.findMany({
      where: {
        userId,
        ...(args.clientId ? { clientId: args.clientId } : {}),
        ...(args.status ? { status: args.status } : {}),
        ...(args.type ? { type: args.type } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        clientId: true,
        type: true,
        title: true,
        link: true,
        notes: true,
        status: true,
        dueDate: true,
        doneAt: true,
        invoiceId: true,
        meetingId: true,
        createdAt: true,
      },
    })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        type: a.type,
        title: truncateText(a.title, TITLE_MAX_CHARS),
        link: truncateNullableText(a.link, NOTE_MAX_CHARS),
        notes: truncateNullableText(a.notes, NOTE_MAX_CHARS),
        status: a.status,
        dueDate: a.dueDate?.toISOString() ?? null,
        doneAt: a.doneAt?.toISOString() ?? null,
        invoiceId: a.invoiceId,
        meetingId: a.meetingId,
        createdAt: a.createdAt.toISOString(),
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  })
}

/**
 * Handler for the log_meeting tool: record a held client meeting.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated meeting payload.
 * @returns The created meeting summary, or an error result.
 */
export async function logMeeting(
  userId: string,
  args: LogMeetingArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "log_meeting", args }, async () => {
    const heldAt = parseIsoDate(args.heldAt, "heldAt")
    const client = await prisma.client.findFirst({
      where: { id: args.clientId, userId },
      select: { id: true },
    })
    if (!client) throw mcpNotFound("Client")

    const created = await prisma.meeting.create({
      data: {
        userId,
        clientId: args.clientId,
        title: args.title,
        teamsUrl: args.teamsUrl ?? null,
        heldAt,
        durationMinutes: args.durationMinutes,
        participants: args.participants,
        agendaMd: args.agendaMd ?? null,
        summaryMd: args.summaryMd ?? null,
      },
      select: {
        id: true,
        clientId: true,
        title: true,
        heldAt: true,
        durationMinutes: true,
        createdAt: true,
      },
    })
    deferActivityLog({
      userId,
      kind: "MEETING_LOGGED",
      title: `Réunion « ${created.title} » consignée`,
      clientId: created.clientId,
    })
    return {
      id: created.id,
      clientId: created.clientId,
      title: truncateText(created.title, TITLE_MAX_CHARS),
      heldAt: created.heldAt.toISOString(),
      durationMinutes: created.durationMinutes,
      createdAt: created.createdAt.toISOString(),
    }
  })
}

/**
 * Handler for the create_action tool: record a follow-up action.
 *
 * Mirrors the HTTP route's relation invariants: linking an invoice or a
 * meeting requires a client, and every linked row must belong to the same
 * principal and client.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated action payload.
 * @returns The created action summary, or an error result.
 */
export async function createAction(
  userId: string,
  args: CreateActionArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "create_action", args }, async () => {
    if (!args.clientId && (args.invoiceId || args.meetingId)) {
      throw new McpToolError(
        "A clientId is required to link an invoice or a meeting",
      )
    }
    const dueDate = args.dueDate ? parseIsoDate(args.dueDate, "dueDate") : null

    if (args.clientId) {
      const clientId = args.clientId
      const client = await prisma.client.findFirst({
        where: { id: clientId, userId },
        select: { id: true },
      })
      if (!client) throw mcpNotFound("Client")

      if (args.invoiceId) {
        const inv = await prisma.invoice.findFirst({
          where: { id: args.invoiceId, userId, clientId },
          select: { id: true },
        })
        if (!inv) throw mcpNotFound("Invoice")
      }
      if (args.meetingId) {
        const meeting = await prisma.meeting.findFirst({
          where: { id: args.meetingId, userId, clientId },
          select: { id: true },
        })
        if (!meeting) throw mcpNotFound("Meeting")
      }
    }

    const created = await prisma.clientAction.create({
      data: {
        userId,
        clientId: args.clientId ?? null,
        type: args.type,
        title: args.title,
        link: args.link ?? null,
        notes: args.notes ?? null,
        dueDate,
        invoiceId: args.invoiceId ?? null,
        meetingId: args.meetingId ?? null,
      },
      select: {
        id: true,
        clientId: true,
        type: true,
        title: true,
        status: true,
        dueDate: true,
        invoiceId: true,
        meetingId: true,
        createdAt: true,
      },
    })
    return {
      id: created.id,
      clientId: created.clientId,
      type: created.type,
      title: truncateText(created.title, TITLE_MAX_CHARS),
      status: created.status,
      dueDate: created.dueDate?.toISOString() ?? null,
      invoiceId: created.invoiceId,
      meetingId: created.meetingId,
      createdAt: created.createdAt.toISOString(),
    }
  })
}

/**
 * Register the meeting and follow-up action tools for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerSuiviTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_meetings",
    {
      description: `List logged client meetings (agenda and summary are truncated). Filter: clientId. ${CAPPED_LIST_NOTE}`,
      inputSchema: listMeetingsInput,
      outputSchema: listMeetingsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listMeetings(userId, args),
  )
  server.registerTool(
    "list_actions",
    {
      description: `List follow-up client actions. Filters: clientId, status, type. ${CAPPED_LIST_NOTE}`,
      inputSchema: listActionsInput,
      outputSchema: listActionsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listActions(userId, args),
  )
  server.registerTool(
    "log_meeting",
    {
      description:
        "Log a held client meeting (title, date, participants, agenda, summary).",
      inputSchema: logMeetingInput,
      outputSchema: logMeetingOutput,
      annotations: writeAnnotations(false),
    },
    (args) => logMeeting(userId, args),
  )
  server.registerTool(
    "create_action",
    {
      description:
        "Create a follow-up action (relance, link, RDV or other), optionally linked to a client, invoice or meeting.",
      inputSchema: createActionInput,
      outputSchema: createActionOutput,
      annotations: writeAnnotations(false),
    },
    (args) => createAction(userId, args),
  )
}
