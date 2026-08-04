import { decimalToNumber } from "@/lib/api"
import type { Prisma } from "@/generated/prisma/client"
import type { TaskGroupDTO } from "./types"

interface TaskGroupRow {
  id: string
  name: string
  clientId: string
  invoiceId: string | null
  invoice?: { number: string } | null
  createdAt: Date
  updatedAt: Date
  tasks: {
    id: string
    linearIdentifier: string
    linearUrl: string | null
    title: string
    estimate: Prisma.Decimal | number | null
    clientId: string
    projectId: string
  }[]
}

export function serializeTaskGroup(group: TaskGroupRow): TaskGroupDTO {
  return {
    id: group.id,
    name: group.name,
    clientId: group.clientId,
    invoiceId: group.invoiceId,
    invoiceNumber: group.invoice?.number ?? null,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
    tasks: group.tasks.map((task) => ({
      id: task.id,
      linearIdentifier: task.linearIdentifier,
      linearUrl: task.linearUrl,
      title: task.title,
      estimate: decimalToNumber(task.estimate),
      clientId: task.clientId,
      projectId: task.projectId,
    })),
  }
}
