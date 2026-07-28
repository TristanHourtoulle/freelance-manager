import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { buildPagedResponse, decimalToNumber } from "@/lib/api"
import { nonBillableReasonSchema, taskStatusSchema } from "@/lib/schemas/task"
import {
  buildBillabilityUpdate,
  validateBillability,
} from "@/domain/tasks/billability"
import {
  CAPPED_LIST_NOTE,
  cursorInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NOTE_MAX_CHARS,
  pagedOutputSchema,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  TITLE_MAX_CHARS,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const listTasksInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  clientIds: z.array(z.string().min(1)).max(50).optional(),
  projectIds: z.array(z.string().min(1)).max(50).optional(),
  status: taskStatusSchema.optional(),
  billable: z.boolean().optional(),
})

const taskRowSchema = z.object({
  id: z.string(),
  linearIdentifier: z.string(),
  title: z.string(),
  status: taskStatusSchema,
  priority: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"]),
  estimate: z.number().nullable(),
  actualDays: z.number().nullable(),
  completedAt: z.string().nullable(),
  invoiceId: z.string().nullable(),
  clientId: z.string(),
  projectId: z.string(),
  billable: z.boolean(),
  nonBillableReason: nonBillableReasonSchema.nullable(),
  nonBillableNote: z.string().nullable(),
})

const listTasksOutput = pagedOutputSchema(taskRowSchema)

const setTaskActualDaysInput = z.object({
  taskId: z.string().min(1),
  actualDays: z
    .number()
    .min(0)
    .max(9999.99)
    .nullable()
    .describe("Real effort spent in days; null clears the value"),
})

const setTaskActualDaysOutput = z.object({
  id: z.string(),
  actualDays: z.number().nullable(),
  estimate: z.number().nullable(),
})

const setTaskBillabilityInput = z.object({
  taskId: z.string().min(1),
  billable: z.boolean(),
  nonBillableReason: nonBillableReasonSchema.nullable().default(null),
  nonBillableNote: z.string().max(500).nullable().default(null),
})

const setTaskBillabilityOutput = z.object({
  id: z.string(),
  billable: z.boolean(),
  nonBillableReason: nonBillableReasonSchema.nullable(),
  nonBillableNote: z.string().nullable(),
})

type ListTasksArgs = z.output<typeof listTasksInput>
type SetTaskActualDaysArgs = z.output<typeof setTaskActualDaysInput>
type SetTaskBillabilityArgs = z.output<typeof setTaskBillabilityInput>

const TASK_ROW_SELECT = {
  id: true,
  linearIdentifier: true,
  title: true,
  status: true,
  priority: true,
  estimate: true,
  actualDays: true,
  completedAt: true,
  invoiceId: true,
  clientId: true,
  projectId: true,
  billable: true,
  nonBillableReason: true,
  nonBillableNote: true,
} as const

/**
 * Handler for the list_tasks tool: capped, userId-scoped task page.
 *
 * Mirrors the app's task list filters. The select deliberately excludes the
 * Linear issue body (`description`) — it is untrusted third-party text and
 * is never exposed through MCP.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated pagination and filter arguments.
 * @returns One page of task rows with titles and notes truncated.
 */
export async function listTasks(
  userId: string,
  args: ListTasksArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_tasks", args }, async () => {
    const rows = await prisma.task.findMany({
      where: {
        userId,
        ...(args.clientIds && args.clientIds.length > 0
          ? { clientId: { in: args.clientIds } }
          : {}),
        ...(args.projectIds && args.projectIds.length > 0
          ? { projectId: { in: args.projectIds } }
          : {}),
        ...(args.billable === undefined ? {} : { billable: args.billable }),
        ...(args.status
          ? { status: args.status }
          : {
              status: {
                in: ["PENDING_INVOICE", "DONE", "IN_PROGRESS", "BACKLOG"],
              },
            }),
      },
      orderBy: [
        { projectId: "asc" },
        { linearIdentifier: "asc" },
        { id: "asc" },
      ],
      take: args.limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      select: TASK_ROW_SELECT,
    })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data.map((t) => ({
        id: t.id,
        linearIdentifier: t.linearIdentifier,
        title: truncateText(t.title, TITLE_MAX_CHARS),
        status: t.status,
        priority: t.priority,
        estimate: decimalToNumber(t.estimate),
        actualDays: decimalToNumber(t.actualDays),
        completedAt: t.completedAt?.toISOString() ?? null,
        invoiceId: t.invoiceId,
        clientId: t.clientId,
        projectId: t.projectId,
        billable: t.billable,
        nonBillableReason: t.nonBillableReason,
        nonBillableNote: truncateNullableText(
          t.nonBillableNote,
          NOTE_MAX_CHARS,
        ),
      })),
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
    }
  })
}

/**
 * Handler for the set_task_actual_days tool.
 *
 * Writes `actualDays` and nothing else: `estimate` is Linear-owned and would
 * be overwritten on the next sync, so this tool never touches it.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated task id and actual-days value.
 * @returns The updated effort fields, or a not-found error result.
 */
export async function setTaskActualDays(
  userId: string,
  args: SetTaskActualDaysArgs,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "set_task_actual_days", args },
    async () => {
      const owned = await prisma.task.findFirst({
        where: { id: args.taskId, userId },
        select: { id: true },
      })
      if (!owned) throw mcpNotFound("Task")
      const updated = await prisma.task.update({
        where: { id: args.taskId },
        data: { actualDays: args.actualDays },
        select: { id: true, actualDays: true, estimate: true },
      })
      return {
        id: updated.id,
        actualDays: decimalToNumber(updated.actualDays),
        estimate: decimalToNumber(updated.estimate),
      }
    },
  )
}

/**
 * Handler for the set_task_billability tool.
 *
 * Reuses the domain invariant (`validateBillability`) and the canonical
 * patch builder (`buildBillabilityUpdate`), so MCP writes can never diverge
 * from the app's billability rules.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated billability payload.
 * @returns The updated billability fields, or an error result.
 */
export async function setTaskBillability(
  userId: string,
  args: SetTaskBillabilityArgs,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "set_task_billability", args },
    async () => {
      const payload = {
        billable: args.billable,
        nonBillableReason: args.nonBillableReason,
        nonBillableNote: args.nonBillableNote,
      }
      const validation = validateBillability(payload)
      if (!validation.ok) throw new McpToolError(validation.error)
      const owned = await prisma.task.findFirst({
        where: { id: args.taskId, userId },
        select: { id: true },
      })
      if (!owned) throw mcpNotFound("Task")
      const updated = await prisma.task.update({
        where: { id: args.taskId },
        data: buildBillabilityUpdate(payload),
        select: {
          id: true,
          billable: true,
          nonBillableReason: true,
          nonBillableNote: true,
        },
      })
      return {
        id: updated.id,
        billable: updated.billable,
        nonBillableReason: updated.nonBillableReason,
        nonBillableNote: truncateNullableText(
          updated.nonBillableNote,
          NOTE_MAX_CHARS,
        ),
      }
    },
  )
}

/**
 * Register the task tools on the given MCP server for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerTaskTools(server: McpServer, userId: string): void {
  server.registerTool(
    "list_tasks",
    {
      description: `List Linear-mirrored tasks with billing state. Filters: clientIds, projectIds, status, billable. ${CAPPED_LIST_NOTE}`,
      inputSchema: listTasksInput,
      outputSchema: listTasksOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listTasks(userId, args),
  )
  server.registerTool(
    "set_task_actual_days",
    {
      description:
        "Set the real effort spent on a task in days (actualDays). Never touches the Linear-owned estimate.",
      inputSchema: setTaskActualDaysInput,
      outputSchema: setTaskActualDaysOutput,
      annotations: writeAnnotations(true),
    },
    (args) => setTaskActualDays(userId, args),
  )
  server.registerTool(
    "set_task_billability",
    {
      description:
        "Mark a task billable or non-billable. A non-billable task requires a reason; reason OTHER requires a note.",
      inputSchema: setTaskBillabilityInput,
      outputSchema: setTaskBillabilityOutput,
      annotations: writeAnnotations(true),
    },
    (args) => setTaskBillability(userId, args),
  )
}
