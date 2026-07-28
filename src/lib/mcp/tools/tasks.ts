import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { getLinearClient } from "@/lib/linear"
import { nonBillableReasonSchema, taskStatusSchema } from "@/lib/schemas/task"
import {
  buildBillabilityUpdate,
  validateBillability,
} from "@/domain/tasks/billability"
import {
  fetchAllInputSchema,
  cursorInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NOTE_MAX_CHARS,
  paginatedOutputSchema,
  PAGINATED_LIST_NOTE,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  TITLE_MAX_CHARS,
  truncateNullableText,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const listTasksInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  fetchAll: fetchAllInputSchema,
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

const listTasksOutput = paginatedOutputSchema(taskRowSchema)

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

const setTaskEstimateInput = z.object({
  taskId: z.string().min(1),
  estimateDays: z
    .number()
    .min(0)
    .max(9999.99)
    .nullable()
    .describe(
      "New estimate in days. Written to the Linear issue's estimate field FIRST — Linear is the source of truth and the next sync would otherwise overwrite a local-only value — and only reflected locally once that write succeeds. null clears the estimate on both sides.",
    ),
})

const setTaskEstimateOutput = z.object({
  id: z.string(),
  estimate: z.number().nullable(),
})

type ListTasksArgs = z.output<typeof listTasksInput>
type SetTaskActualDaysArgs = z.output<typeof setTaskActualDaysInput>
type SetTaskBillabilityArgs = z.output<typeof setTaskBillabilityInput>
type SetTaskEstimateArgs = z.output<typeof setTaskEstimateInput>

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
 * Handler for the list_tasks tool: userId-scoped task page on the v2
 * pagination contract (uncapped `total`, optional `fetchAll`).
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
    const where: Prisma.TaskWhereInput = {
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
    }

    const result = await runPaginatedQuery({
      args,
      count: () => prisma.task.count({ where }),
      page: ({ cursor, take }) =>
        prisma.task.findMany({
          where,
          orderBy: [
            { projectId: "asc" },
            { linearIdentifier: "asc" },
            { id: "asc" },
          ],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          select: TASK_ROW_SELECT,
        }),
    })

    return {
      data: result.data.map((t) => ({
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
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
    }
  })
}

/**
 * Handler for the set_task_actual_days tool.
 *
 * Writes `actualDays` and nothing else: `estimate` is Linear-owned and would
 * be overwritten on the next sync, so this tool never touches it. Use
 * `set_task_estimate` to change the estimate itself.
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
 * Handler for the set_task_estimate tool.
 *
 * The app's Linear sync treats `Task.estimate` as Linear-owned (see
 * `LINEAR_MIRRORED_TASK_FIELDS` in `src/lib/linear.ts`): any local-only write
 * to it is silently overwritten by the next sync. This tool therefore writes
 * to Linear FIRST, using the app's own stored credential
 * (`getLinearClient`) — never the MCP bearer token, which never leaves the
 * request layer — and only mirrors the value locally once that write
 * succeeds. Ordering rationale: if the Linear call fails, the local row is
 * left untouched, so it can never silently diverge from Linear (a
 * local-then-Linear order would instead let a failed Linear write leave a
 * local value that a later sync would silently revert with no error ever
 * surfaced). If the local write fails after Linear already succeeded, the
 * two are briefly inconsistent but self-heal on the next sync, which is the
 * strictly safer failure mode of the two orderings.
 *
 * Touches the Linear issue's `estimate` field only — never title,
 * description, state, assignee or labels, and never creates or deletes an
 * issue.
 *
 * @param userId - The resolved MCP principal.
 * @param args - Validated task id and new estimate.
 * @returns The updated estimate, or an error result (not-found, no Linear
 *   token configured, or the Linear write itself failing).
 */
export async function setTaskEstimate(
  userId: string,
  args: SetTaskEstimateArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "set_task_estimate", args }, async () => {
    const owned = await prisma.task.findFirst({
      where: { id: args.taskId, userId },
      select: { id: true, linearIssueId: true },
    })
    if (!owned) throw mcpNotFound("Task")

    const userLinear = await getLinearClient(userId)
    if (!userLinear) {
      throw new McpToolError("No Linear token configured for this user")
    }

    try {
      await userLinear.client.updateIssue(owned.linearIssueId, {
        estimate: args.estimateDays,
      })
    } catch (err) {
      console.error(
        `[mcp] set_task_estimate: Linear write failed for task ${owned.id}`,
        err,
      )
      throw new McpToolError(
        "Failed to write the estimate to the Linear issue; the local value was left untouched so it can never silently diverge from Linear",
      )
    }

    const updated = await prisma.task.update({
      where: { id: owned.id },
      data: { estimate: args.estimateDays },
      select: { id: true, estimate: true },
    })

    return {
      id: updated.id,
      estimate: decimalToNumber(updated.estimate),
    }
  })
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
      description: `List Linear-mirrored tasks with billing state. Filters: clientIds, projectIds, status, billable. ${PAGINATED_LIST_NOTE}`,
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
  server.registerTool(
    "set_task_estimate",
    {
      description:
        "Set a task's estimate in days by writing it to the Linear issue first (via the app's own stored Linear credential, never the MCP bearer token), then mirroring it locally. Only the estimate field is touched on the Linear issue. If the Linear write fails the local value is left untouched, so it never silently diverges from Linear.",
      inputSchema: setTaskEstimateInput,
      outputSchema: setTaskEstimateOutput,
      annotations: writeAnnotations(true),
    },
    (args) => setTaskEstimate(userId, args),
  )
}
