import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { deferActivityLog } from "@/lib/activity"
import {
  clientActionStatusSchema,
  clientActionTypeSchema,
} from "@/lib/schemas/action"
import { meetingUpdateSchema } from "@/lib/schemas/meeting"
import {
  cursorInputSchema,
  fetchAllInputSchema,
  isoDateInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NAME_MAX_CHARS,
  NOTE_MAX_CHARS,
  paginatedOutputSchema,
  PAGINATED_LIST_NOTE,
  parseIsoDate,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  TITLE_MAX_CHARS,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

/**
 * Annotations for `delete_meeting`: the only tool on the whole MCP surface
 * that carries `destructiveHint: true`. Marked idempotent because a repeat
 * call after the first successful delete leaves the environment in the same
 * state (the meeting stays gone) even though the second call itself returns
 * a not-found error.
 */
const DELETE_MEETING_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
}

const listMeetingsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  clientId: z.string().min(1).optional(),
  fetchAll: fetchAllInputSchema,
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

const listMeetingsOutput = paginatedOutputSchema(meetingRowSchema)

const listActionsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  clientId: z.string().min(1).optional(),
  status: clientActionStatusSchema.optional(),
  type: clientActionTypeSchema.optional(),
  fetchAll: fetchAllInputSchema,
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

const listActionsOutput = paginatedOutputSchema(actionRowSchema)

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

const updateMeetingInput = z
  .object({ id: z.string().min(1) })
  .extend(meetingUpdateSchema.shape)
  .extend({
    heldAt: isoDateInputSchema
      .optional()
      .describe("When the meeting took place"),
  })

const deleteMeetingInput = z.object({
  id: z.string().min(1),
})

const deletedMeetingOutput = meetingRowSchema.extend({
  teamsUrl: z.string().nullable(),
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

const completeActionInput = z.object({
  id: z.string().min(1),
})

type ListMeetingsArgs = z.output<typeof listMeetingsInput>
type ListActionsArgs = z.output<typeof listActionsInput>
type LogMeetingArgs = z.output<typeof logMeetingInput>
type UpdateMeetingArgs = z.output<typeof updateMeetingInput>
type DeleteMeetingArgs = z.output<typeof deleteMeetingInput>
type CreateActionArgs = z.output<typeof createActionInput>
type CompleteActionArgs = z.output<typeof completeActionInput>

const MEETING_ROW_SELECT = {
  id: true,
  clientId: true,
  title: true,
  heldAt: true,
  durationMinutes: true,
  participants: true,
  agendaMd: true,
  summaryMd: true,
  _count: { select: { actions: true } },
} as const

const ACTION_ROW_SELECT = {
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
} as const

/**
 * Handler for the list_meetings tool: paginated, userId-scoped meeting page
 * on the v2 pagination contract (uncapped `total`, opt-in `fetchAll`).
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page (or the full walked set) of meeting rows, free text
 * truncated.
 */
export async function listMeetings(
  userId: string,
  args: ListMeetingsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_meetings", args }, async () => {
    const where = {
      userId,
      ...(args.clientId ? { clientId: args.clientId } : {}),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.meeting.count({ where }),
      page: ({ cursor, take }) =>
        prisma.meeting.findMany({
          where,
          orderBy: [{ heldAt: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: MEETING_ROW_SELECT,
        }),
    })
    return {
      data: result.data.map((m) => ({
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
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
    }
  })
}

/**
 * Handler for the list_actions tool: paginated, userId-scoped follow-up
 * actions on the v2 pagination contract (uncapped `total`, opt-in
 * `fetchAll`).
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page (or the full walked set) of action rows, free text
 * truncated.
 */
export async function listActions(
  userId: string,
  args: ListActionsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_actions", args }, async () => {
    const where = {
      userId,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      ...(args.status ? { status: args.status } : {}),
      ...(args.type ? { type: args.type } : {}),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.clientAction.count({ where }),
      page: ({ cursor, take }) =>
        prisma.clientAction.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: ACTION_ROW_SELECT,
        }),
    })
    return {
      data: result.data.map((a) => ({
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
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
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
 * Handler for the update_meeting tool: partial update of a logged meeting.
 *
 * Mirrors `PATCH /api/meetings/[id]` field-for-field: only keys present in
 * the input are written, `clientId` is immutable, and ownership is checked
 * before the write.
 *
 * @param userId - The resolved MCP principal.
 * @param args - The meeting id plus the partial fields to change.
 * @returns The updated meeting row, or a not-found error result.
 */
export async function updateMeeting(
  userId: string,
  args: UpdateMeetingArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "update_meeting", args }, async () => {
    const { id, ...data } = args
    const owned = await prisma.meeting.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!owned) throw mcpNotFound("Meeting")

    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...("title" in data ? { title: data.title } : {}),
        ...("teamsUrl" in data ? { teamsUrl: data.teamsUrl ?? null } : {}),
        ...("heldAt" in data && data.heldAt !== undefined
          ? { heldAt: parseIsoDate(data.heldAt, "heldAt") }
          : {}),
        ...("durationMinutes" in data
          ? { durationMinutes: data.durationMinutes ?? 0 }
          : {}),
        ...("participants" in data
          ? { participants: data.participants ?? [] }
          : {}),
        ...("agendaMd" in data ? { agendaMd: data.agendaMd ?? null } : {}),
        ...("summaryMd" in data ? { summaryMd: data.summaryMd ?? null } : {}),
      },
      select: MEETING_ROW_SELECT,
    })
    return {
      id: updated.id,
      clientId: updated.clientId,
      title: truncateText(updated.title, TITLE_MAX_CHARS),
      heldAt: updated.heldAt.toISOString(),
      durationMinutes: updated.durationMinutes,
      participants: updated.participants.map((p) =>
        truncateText(p, NAME_MAX_CHARS),
      ),
      agenda: truncateNullableText(updated.agendaMd, NOTE_MAX_CHARS),
      summary: truncateNullableText(updated.summaryMd, NOTE_MAX_CHARS),
      actionsCount: updated._count.actions,
    }
  })
}

/**
 * Handler for the delete_meeting tool: permanently delete a logged meeting.
 *
 * Irreversible. `ClientAction.meetingId` has an `onDelete: SetNull` foreign
 * key (see `prisma/schema.prisma`), so any follow-up action linked to this
 * meeting is NOT deleted — it survives with `meetingId` cleared. The delete
 * itself is scoped by `{id, userId}` via `deleteMany`, so a foreign id
 * deletes nothing; ownership is still checked first so the response can
 * carry the deleted row.
 *
 * @param userId - The resolved MCP principal.
 * @param args - The meeting id to delete.
 * @returns The full deleted meeting (enough detail to recreate it by hand),
 * or a not-found error result.
 */
export async function deleteMeeting(
  userId: string,
  args: DeleteMeetingArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "delete_meeting", args }, async () => {
    const existing = await prisma.meeting.findFirst({
      where: { id: args.id, userId },
      select: { ...MEETING_ROW_SELECT, teamsUrl: true },
    })
    if (!existing) throw mcpNotFound("Meeting")

    await prisma.meeting.deleteMany({ where: { id: args.id, userId } })

    return {
      id: existing.id,
      clientId: existing.clientId,
      title: truncateText(existing.title, TITLE_MAX_CHARS),
      teamsUrl: truncateNullableText(existing.teamsUrl, NOTE_MAX_CHARS),
      heldAt: existing.heldAt.toISOString(),
      durationMinutes: existing.durationMinutes,
      participants: existing.participants.map((p) =>
        truncateText(p, NAME_MAX_CHARS),
      ),
      agenda: truncateNullableText(existing.agendaMd, NOTE_MAX_CHARS),
      summary: truncateNullableText(existing.summaryMd, NOTE_MAX_CHARS),
      actionsCount: existing._count.actions,
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
 * Handler for the complete_action tool: mark a follow-up action done.
 *
 * Mirrors `PATCH /api/actions/[id]`: transitioning to DONE stamps `doneAt`
 * and writes a `deferActivityLog(ACTION_DONE)` row. Re-completing an
 * already-DONE action is a deliberate no-op — it neither re-stamps `doneAt`
 * (which would erase the original completion time) nor writes a second
 * activity log entry, and no DB write happens at all. This makes the tool
 * genuinely idempotent (`idempotentHint: true`): calling it twice in a row
 * leaves the same state as calling it once.
 *
 * @param userId - The resolved MCP principal.
 * @param args - The action id to complete.
 * @returns The (possibly unchanged) action row, or a not-found error result.
 */
export async function completeAction(
  userId: string,
  args: CompleteActionArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "complete_action", args }, async () => {
    const existing = await prisma.clientAction.findFirst({
      where: { id: args.id, userId },
      select: ACTION_ROW_SELECT,
    })
    if (!existing) throw mcpNotFound("Action")

    const alreadyDone = existing.status === "DONE"
    const row = alreadyDone
      ? existing
      : await prisma.clientAction.update({
          where: { id: existing.id },
          data: { status: "DONE", doneAt: new Date() },
          select: ACTION_ROW_SELECT,
        })

    if (!alreadyDone) {
      deferActivityLog({
        userId,
        kind: "ACTION_DONE",
        title: `Action « ${row.title} » faite`,
        clientId: existing.clientId,
      })
    }

    return {
      id: row.id,
      clientId: row.clientId,
      type: row.type,
      title: truncateText(row.title, TITLE_MAX_CHARS),
      link: truncateNullableText(row.link, NOTE_MAX_CHARS),
      notes: truncateNullableText(row.notes, NOTE_MAX_CHARS),
      status: row.status,
      dueDate: row.dueDate?.toISOString() ?? null,
      doneAt: row.doneAt?.toISOString() ?? null,
      invoiceId: row.invoiceId,
      meetingId: row.meetingId,
      createdAt: row.createdAt.toISOString(),
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
      description: `List logged client meetings (agenda and summary are truncated). Filter: clientId. ${PAGINATED_LIST_NOTE}`,
      inputSchema: listMeetingsInput,
      outputSchema: listMeetingsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listMeetings(userId, args),
  )
  server.registerTool(
    "list_actions",
    {
      description: `List follow-up client actions. Filters: clientId, status, type. ${PAGINATED_LIST_NOTE}`,
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
    "update_meeting",
    {
      description:
        "Update a logged client meeting's title, date, duration, participants, Teams link, agenda or summary. Only the fields provided in the call are changed; the client is immutable.",
      inputSchema: updateMeetingInput,
      outputSchema: meetingRowSchema,
      annotations: writeAnnotations(true),
    },
    (args) => updateMeeting(userId, args),
  )
  server.registerTool(
    "delete_meeting",
    {
      description:
        "Permanently delete a client meeting. THIS IS IRREVERSIBLE — the meeting cannot be recovered. The result returns the full deleted meeting (title, date, duration, participants, Teams link, agenda, summary) so it can be recreated by hand if needed. Follow-up actions linked to this meeting are NOT deleted: only their meetingId link is cleared, the actions themselves remain.",
      inputSchema: deleteMeetingInput,
      outputSchema: deletedMeetingOutput,
      annotations: DELETE_MEETING_ANNOTATIONS,
    },
    (args) => deleteMeeting(userId, args),
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
  server.registerTool(
    "complete_action",
    {
      description:
        "Mark a follow-up action as done, stamping doneAt. Calling it again on an already-done action is a no-op that returns the current state unchanged.",
      inputSchema: completeActionInput,
      outputSchema: actionRowSchema,
      annotations: writeAnnotations(true),
    },
    (args) => completeAction(userId, args),
  )
}
