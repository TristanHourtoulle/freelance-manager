import type { Prisma } from "@/generated/prisma/client"

interface GroupedLine {
  taskId?: string | null
  taskGroupId?: string | null
}

export class InvoiceTaskGroupConflictError extends Error {}

/**
 * Verifies that every requested group is owned by the invoice client, still
 * unbilled, fully represented by its task lines, and contains only eligible
 * tasks. Partial groups are deliberately rejected.
 */
export async function validateInvoiceTaskGroups(
  tx: Prisma.TransactionClient,
  args: {
    userId: string
    clientId: string
    invoiceId?: string
    taskIds?: readonly string[]
    taskGroupIds: readonly string[]
    lines: readonly GroupedLine[]
  },
) {
  const expectedGroupByTask = new Map<string, string | null>()
  for (const line of args.lines) {
    if (!line.taskId) continue
    const expected = line.taskGroupId ?? null
    const previous = expectedGroupByTask.get(line.taskId)
    if (previous !== undefined && previous !== expected) {
      throw new InvoiceTaskGroupConflictError()
    }
    expectedGroupByTask.set(line.taskId, expected)
  }
  for (const taskId of args.taskIds ?? []) {
    if (!expectedGroupByTask.has(taskId)) expectedGroupByTask.set(taskId, null)
  }

  if (expectedGroupByTask.size > 0) {
    const tasks = await tx.task.findMany({
      where: {
        id: { in: [...expectedGroupByTask.keys()] },
        userId: args.userId,
        clientId: args.clientId,
      },
      select: {
        id: true,
        taskGroupId: true,
        status: true,
        billable: true,
        invoiceId: true,
      },
    })
    if (
      tasks.length !== expectedGroupByTask.size ||
      tasks.some(
        (task) =>
          task.status !== "PENDING_INVOICE" ||
          !task.billable ||
          (task.invoiceId !== null && task.invoiceId !== args.invoiceId) ||
          task.taskGroupId !== expectedGroupByTask.get(task.id),
      )
    ) {
      throw new InvoiceTaskGroupConflictError()
    }
  }

  if (args.taskGroupIds.length === 0) return
  const groups = await tx.taskGroup.findMany({
    where: {
      id: { in: [...args.taskGroupIds] },
      userId: args.userId,
      clientId: args.clientId,
      ...(args.invoiceId
        ? { OR: [{ invoiceId: null }, { invoiceId: args.invoiceId }] }
        : { invoiceId: null }),
    },
    select: {
      id: true,
      invoiceId: true,
      tasks: {
        select: {
          id: true,
          status: true,
          billable: true,
          invoiceId: true,
        },
      },
    },
  })
  if (groups.length !== args.taskGroupIds.length) {
    throw new InvoiceTaskGroupConflictError()
  }

  for (const group of groups) {
    const lineTaskIds = args.lines
      .filter((line) => line.taskGroupId === group.id)
      .map((line) => line.taskId)
    if (lineTaskIds.some((id) => !id)) {
      throw new InvoiceTaskGroupConflictError()
    }
    const represented = new Set(lineTaskIds as string[])
    const persisted = new Set(group.tasks.map((task) => task.id))
    if (
      represented.size !== persisted.size ||
      [...persisted].some((taskId) => !represented.has(taskId)) ||
      group.tasks.some(
        (task) =>
          task.status !== "PENDING_INVOICE" ||
          !task.billable ||
          task.invoiceId !== null,
      )
    ) {
      throw new InvoiceTaskGroupConflictError()
    }
  }
}

export async function claimInvoiceTaskGroups(
  tx: Prisma.TransactionClient,
  args: {
    userId: string
    clientId: string
    invoiceId: string
    taskGroupIds: readonly string[]
  },
) {
  if (args.taskGroupIds.length === 0) return
  const claimed = await tx.taskGroup.updateMany({
    where: {
      id: { in: [...args.taskGroupIds] },
      userId: args.userId,
      clientId: args.clientId,
      OR: [{ invoiceId: null }, { invoiceId: args.invoiceId }],
    },
    data: { invoiceId: args.invoiceId },
  })
  if (claimed.count !== args.taskGroupIds.length) {
    throw new InvoiceTaskGroupConflictError()
  }
}
