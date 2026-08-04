import "server-only"
import { revalidateTag } from "next/cache"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js"
import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"
import { decimalToNumber } from "@/lib/api"
import { taskGroupsTag } from "@/lib/data/task-groups"
import {
  cursorInputSchema,
  fetchAllInputSchema,
  limitInputSchema,
  McpToolError,
  mcpNotFound,
  NAME_MAX_CHARS,
  paginatedOutputSchema,
  PAGINATED_LIST_NOTE,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  runPaginatedQuery,
  TITLE_MAX_CHARS,
  truncateText,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

const taskIdsSchema = z
  .array(z.string().min(1))
  .min(1)
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "A task can only appear once in a group",
  })

const groupStatusSchema = z.enum(["pending", "invoiced", "all"])

const listTaskGroupsInput = z.object({
  cursor: cursorInputSchema,
  limit: limitInputSchema,
  fetchAll: fetchAllInputSchema,
  clientId: z.string().min(1).optional(),
  status: groupStatusSchema.default("pending"),
})

const taskGroupTaskSchema = z.object({
  id: z.string(),
  linearIdentifier: z.string(),
  title: z.string(),
  estimate: z.number().nullable(),
  clientId: z.string(),
  projectId: z.string(),
})

const taskGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  clientId: z.string(),
  invoiceId: z.string().nullable(),
  invoiceNumber: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tasks: z.array(taskGroupTaskSchema),
})

const listTaskGroupsOutput = paginatedOutputSchema(taskGroupSchema)
const createTaskGroupInput = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(NAME_MAX_CHARS),
  taskIds: taskIdsSchema,
})
const updateTaskGroupInput = z.object({
  groupId: z.string().min(1),
  name: z.string().trim().min(1).max(NAME_MAX_CHARS),
  taskIds: taskIdsSchema,
})
const deleteTaskGroupInput = z.object({ groupId: z.string().min(1) })
const deleteTaskGroupOutput = z.object({
  id: z.string(),
  releasedTaskCount: z.number().int().min(0),
})

type ListTaskGroupsArgs = z.output<typeof listTaskGroupsInput>
type CreateTaskGroupArgs = z.output<typeof createTaskGroupInput>
type UpdateTaskGroupArgs = z.output<typeof updateTaskGroupInput>
type DeleteTaskGroupArgs = z.output<typeof deleteTaskGroupInput>

const GROUP_TASK_SELECT = {
  id: true,
  linearIdentifier: true,
  title: true,
  estimate: true,
  clientId: true,
  projectId: true,
} satisfies Prisma.TaskSelect

const GROUP_INCLUDE = {
  invoice: { select: { number: true } },
  tasks: {
    select: GROUP_TASK_SELECT,
    orderBy: [{ projectId: "asc" }, { linearIdentifier: "asc" }],
  },
} satisfies Prisma.TaskGroupInclude

type GroupRow = Prisma.TaskGroupGetPayload<{ include: typeof GROUP_INCLUDE }>

function toTaskGroup(row: GroupRow) {
  return {
    id: row.id,
    name: truncateText(row.name, NAME_MAX_CHARS),
    clientId: row.clientId,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice?.number ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tasks: row.tasks.map((task) => ({
      id: task.id,
      linearIdentifier: task.linearIdentifier,
      title: truncateText(task.title, TITLE_MAX_CHARS),
      estimate: decimalToNumber(task.estimate),
      clientId: task.clientId,
      projectId: task.projectId,
    })),
  }
}

function conflict(message: string, code: string): McpToolError {
  return new McpToolError(message, { code })
}

export async function listTaskGroups(
  userId: string,
  args: ListTaskGroupsArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "list_task_groups", args }, async () => {
    const where = {
      userId,
      ...(args.clientId ? { clientId: args.clientId } : {}),
      ...(args.status === "pending"
        ? { invoiceId: null }
        : args.status === "invoiced"
          ? { invoiceId: { not: null } }
          : {}),
    }
    const result = await runPaginatedQuery({
      args,
      count: () => prisma.taskGroup.count({ where }),
      page: ({ cursor, take }) =>
        prisma.taskGroup.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          include: GROUP_INCLUDE,
        }),
    })
    return {
      data: result.data.map(toTaskGroup),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
      truncated: result.truncated,
    }
  })
}

export async function createTaskGroup(
  userId: string,
  args: CreateTaskGroupArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "create_task_group", args }, async () => {
    const client = await prisma.client.findFirst({
      where: { id: args.clientId, userId },
      select: { id: true },
    })
    if (!client) throw mcpNotFound("Client")

    const created = await prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({
        where: {
          id: { in: args.taskIds },
          userId,
          clientId: args.clientId,
          status: "PENDING_INVOICE",
          billable: true,
          invoiceId: null,
          taskGroupId: null,
        },
        select: GROUP_TASK_SELECT,
        orderBy: [{ projectId: "asc" }, { linearIdentifier: "asc" }],
      })
      if (tasks.length !== args.taskIds.length) {
        throw conflict(
          "Every task must be unbilled, billable, ungrouped, and owned by the selected client.",
          "TASKS_NOT_GROUPABLE",
        )
      }

      const group = await tx.taskGroup.create({
        data: { userId, clientId: args.clientId, name: args.name },
      })
      const claimed = await tx.task.updateMany({
        where: {
          id: { in: args.taskIds },
          userId,
          clientId: args.clientId,
          invoiceId: null,
          taskGroupId: null,
        },
        data: { taskGroupId: group.id },
      })
      if (claimed.count !== args.taskIds.length) {
        throw conflict(
          "One or more tasks were claimed concurrently; no group was created.",
          "TASKS_NOT_GROUPABLE",
        )
      }
      return { ...group, invoice: null, tasks }
    })

    revalidateTag(taskGroupsTag(userId), "max")
    return toTaskGroup(created)
  })
}

export async function updateTaskGroup(
  userId: string,
  args: UpdateTaskGroupArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "update_task_group", args }, async () => {
    const current = await prisma.taskGroup.findFirst({
      where: { id: args.groupId, userId },
      select: { id: true, clientId: true, invoiceId: true },
    })
    if (!current) throw mcpNotFound("Task group")
    if (current.invoiceId) {
      throw conflict(
        "An invoiced task group is locked and cannot be edited.",
        "TASK_GROUP_ALREADY_INVOICED",
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      const editable = await tx.taskGroup.updateMany({
        where: { id: current.id, userId, invoiceId: null },
        data: { name: args.name },
      })
      if (editable.count !== 1) {
        throw conflict(
          "The task group is no longer editable.",
          "TASK_GROUP_CONFLICT",
        )
      }

      const tasks = await tx.task.findMany({
        where: {
          id: { in: args.taskIds },
          userId,
          clientId: current.clientId,
          status: "PENDING_INVOICE",
          billable: true,
          invoiceId: null,
          OR: [{ taskGroupId: null }, { taskGroupId: current.id }],
        },
        select: { id: true },
      })
      if (tasks.length !== args.taskIds.length) {
        throw conflict(
          "Every task must be unbilled, billable, and belong to the group's client.",
          "TASKS_NOT_GROUPABLE",
        )
      }

      await tx.task.updateMany({
        where: { taskGroupId: current.id, userId },
        data: { taskGroupId: null },
      })
      const claimed = await tx.task.updateMany({
        where: {
          id: { in: args.taskIds },
          userId,
          clientId: current.clientId,
          invoiceId: null,
          taskGroupId: null,
        },
        data: { taskGroupId: current.id },
      })
      if (claimed.count !== args.taskIds.length) {
        throw conflict(
          "One or more tasks were claimed concurrently; the group was not changed.",
          "TASKS_NOT_GROUPABLE",
        )
      }

      const row = await tx.taskGroup.findFirst({
        where: { id: current.id, userId, invoiceId: null },
        include: GROUP_INCLUDE,
      })
      if (!row)
        throw conflict(
          "The task group is no longer editable.",
          "TASK_GROUP_CONFLICT",
        )
      return row
    })

    revalidateTag(taskGroupsTag(userId), "max")
    return toTaskGroup(updated)
  })
}

export async function deleteTaskGroup(
  userId: string,
  args: DeleteTaskGroupArgs,
): Promise<CallToolResult> {
  return runMcpTool({ userId, tool: "delete_task_group", args }, async () => {
    const current = await prisma.taskGroup.findFirst({
      where: { id: args.groupId, userId },
      select: { id: true, clientId: true, invoiceId: true },
    })
    if (!current) throw mcpNotFound("Task group")
    if (current.invoiceId) {
      throw conflict(
        "An invoiced task group is locked and cannot be deleted.",
        "TASK_GROUP_ALREADY_INVOICED",
      )
    }

    const releasedTaskCount = await prisma.$transaction(async (tx) => {
      const released = await tx.task.updateMany({
        where: { taskGroupId: current.id, userId },
        data: { taskGroupId: null },
      })
      const deleted = await tx.taskGroup.deleteMany({
        where: { id: current.id, userId, invoiceId: null },
      })
      if (deleted.count !== 1) {
        throw conflict(
          "The task group is no longer editable.",
          "TASK_GROUP_CONFLICT",
        )
      }
      return released.count
    })

    revalidateTag(taskGroupsTag(userId), "max")
    return { id: current.id, releasedTaskCount }
  })
}

const DELETE_ANNOTATIONS: ToolAnnotations = {
  ...writeAnnotations(false),
  destructiveHint: true,
}

export function registerTaskGroupTools(
  server: McpServer,
  userId: string,
): void {
  server.registerTool(
    "list_task_groups",
    {
      description: `List ad-hoc task groups with their complete task membership. Filters: clientId and status. ${PAGINATED_LIST_NOTE}`,
      inputSchema: listTaskGroupsInput,
      outputSchema: listTaskGroupsOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    (args) => listTaskGroups(userId, args),
  )
  server.registerTool(
    "create_task_group",
    {
      description:
        "Create an ad-hoc group from unbilled, billable, currently ungrouped tasks belonging to one client. Cross-client and duplicate membership are rejected atomically.",
      inputSchema: createTaskGroupInput,
      outputSchema: taskGroupSchema,
      annotations: writeAnnotations(false),
    },
    (args) => createTaskGroup(userId, args),
  )
  server.registerTool(
    "update_task_group",
    {
      description:
        "Rename an unbilled group and replace its complete task membership. The client is immutable; cross-client, already-grouped, or invoiced tasks are rejected atomically.",
      inputSchema: updateTaskGroupInput,
      outputSchema: taskGroupSchema,
      annotations: writeAnnotations(false),
    },
    (args) => updateTaskGroup(userId, args),
  )
  server.registerTool(
    "delete_task_group",
    {
      description:
        "Permanently delete an unbilled task group and release its tasks. Invoiced groups are locked and refused.",
      inputSchema: deleteTaskGroupInput,
      outputSchema: deleteTaskGroupOutput,
      annotations: DELETE_ANNOTATIONS,
    },
    (args) => deleteTaskGroup(userId, args),
  )
}
