import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, txMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findFirst: vi.fn() },
    taskGroup: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: {
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    taskGroup: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

import {
  createTaskGroup,
  deleteTaskGroup,
  listTaskGroups,
  updateTaskGroup,
} from "./task-groups"

const USER_ID = "user-1"
const now = new Date("2026-08-04T12:00:00.000Z")

function task(id = "task-1") {
  return {
    id,
    linearIdentifier: id === "task-1" ? "QUI-1" : "QUI-2",
    title: `Task ${id}`,
    estimate: 1,
    clientId: "client-1",
    projectId: "project-1",
  }
}

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    name: "Bucket & CDN",
    clientId: "client-1",
    invoiceId: null,
    invoice: null,
    createdAt: now,
    updatedAt: now,
    tasks: [task()],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
  prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
  prismaMock.taskGroup.count.mockResolvedValue(0)
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
  txMock.task.findMany.mockResolvedValue([task()])
  txMock.task.updateMany.mockResolvedValue({ count: 1 })
  txMock.taskGroup.create.mockResolvedValue(group({ tasks: undefined }))
  txMock.taskGroup.updateMany.mockResolvedValue({ count: 1 })
  txMock.taskGroup.deleteMany.mockResolvedValue({ count: 1 })
  txMock.taskGroup.findFirst.mockResolvedValue(group())
})

describe("listTaskGroups", () => {
  it("scopes every list to the MCP principal and optional client", async () => {
    prismaMock.taskGroup.findMany.mockResolvedValue([])

    await listTaskGroups(USER_ID, {
      clientId: "client-1",
      status: "pending",
      limit: 25,
      fetchAll: false,
    })

    expect(prismaMock.taskGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          clientId: "client-1",
          invoiceId: null,
        },
      }),
    )
  })
})

describe("createTaskGroup", () => {
  it("claims only eligible, ungrouped tasks owned by the same client", async () => {
    const result = await createTaskGroup(USER_ID, {
      clientId: "client-1",
      name: "Bucket & CDN",
      taskIds: ["task-1"],
    })

    expect(result.isError).toBeUndefined()
    expect(txMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["task-1"] },
          userId: USER_ID,
          clientId: "client-1",
          status: "PENDING_INVOICE",
          billable: true,
          invoiceId: null,
          taskGroupId: null,
        },
      }),
    )
  })

  it("rejects cross-client or already-grouped tasks atomically", async () => {
    txMock.task.findMany.mockResolvedValue([])

    const result = await createTaskGroup(USER_ID, {
      clientId: "client-1",
      name: "Invalid",
      taskIds: ["foreign-task"],
    })

    expect(result.isError).toBe(true)
    expect(txMock.taskGroup.create).not.toHaveBeenCalled()
  })
})

describe("updateTaskGroup", () => {
  it("never accepts a clientId and keeps membership inside the persisted client", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue({
      id: "group-1",
      clientId: "client-1",
      invoiceId: null,
    })

    await updateTaskGroup(USER_ID, {
      groupId: "group-1",
      name: "Updated",
      taskIds: ["task-1"],
    })

    expect(txMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: "client-1" }),
      }),
    )
  })

  it("refuses to mutate an invoiced group", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue({
      id: "group-1",
      clientId: "client-1",
      invoiceId: "invoice-1",
    })

    const result = await updateTaskGroup(USER_ID, {
      groupId: "group-1",
      name: "Updated",
      taskIds: ["task-1"],
    })

    expect(result.isError).toBe(true)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("deleteTaskGroup", () => {
  it("releases tasks and deletes only an unbilled owned group", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue({
      id: "group-1",
      clientId: "client-1",
      invoiceId: null,
    })

    const result = await deleteTaskGroup(USER_ID, { groupId: "group-1" })

    expect(result.isError).toBeUndefined()
    expect(txMock.task.updateMany).toHaveBeenCalledWith({
      where: { taskGroupId: "group-1", userId: USER_ID },
      data: { taskGroupId: null },
    })
    expect(txMock.taskGroup.deleteMany).toHaveBeenCalledWith({
      where: { id: "group-1", userId: USER_ID, invoiceId: null },
    })
  })
})
