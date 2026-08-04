import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, getAuthUser } = vi.hoisted(() => ({
  prismaMock: {
    client: { findFirst: vi.fn() },
    taskGroup: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  getAuthUser: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const tx = {
  task: { findMany: vi.fn(), updateMany: vi.fn() },
  taskGroup: { create: vi.fn() },
}

function post(body: Record<string, unknown>) {
  return new Request("http://localhost/api/task-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const tasks = [
  {
    id: "task-1",
    linearIdentifier: "TRI-1",
    linearUrl: null,
    title: "Optimiser les images",
    estimate: 1,
    clientId: "client-1",
    projectId: "project-1",
  },
  {
    id: "task-2",
    linearIdentifier: "TRI-2",
    linearUrl: null,
    title: "Configurer le CDN",
    estimate: 2,
    clientId: "client-1",
    projectId: "project-1",
  },
]

describe("POST /api/task-groups", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    tx.task.findMany.mockResolvedValue(tasks)
    tx.task.updateMany.mockResolvedValue({ count: 2 })
    tx.taskGroup.create.mockResolvedValue({
      id: "group-1",
      name: "Bucket & CDN",
      clientId: "client-1",
      invoiceId: null,
      createdAt: new Date("2026-08-04T10:00:00.000Z"),
      updatedAt: new Date("2026-08-04T10:00:00.000Z"),
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    )
  })

  it("creates a client-scoped group and atomically claims every task", async () => {
    const { POST } = await import("./route")
    const response = await POST(
      post({
        clientId: "client-1",
        name: "Bucket & CDN",
        taskIds: ["task-1", "task-2"],
      }),
    )

    expect(response.status).toBe(201)
    expect(tx.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          clientId: "client-1",
          invoiceId: null,
          taskGroupId: null,
          billable: true,
          status: "PENDING_INVOICE",
        }),
      }),
    )
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["task-1", "task-2"] },
        userId: "user-1",
        clientId: "client-1",
        invoiceId: null,
        taskGroupId: null,
      },
      data: { taskGroupId: "group-1" },
    })
  })

  it("rejects a cross-client or otherwise ineligible task set", async () => {
    tx.task.findMany.mockResolvedValue([tasks[0]])
    const { POST } = await import("./route")
    const response = await POST(
      post({
        clientId: "client-1",
        name: "Bucket & CDN",
        taskIds: ["task-1", "task-from-other-client"],
      }),
    )

    expect(response.status).toBe(409)
    expect(tx.taskGroup.create).not.toHaveBeenCalled()
  })

  it("rolls back when another request claims a task concurrently", async () => {
    tx.task.updateMany.mockResolvedValue({ count: 1 })
    const { POST } = await import("./route")
    const response = await POST(
      post({
        clientId: "client-1",
        name: "Bucket & CDN",
        taskIds: ["task-1", "task-2"],
      }),
    )

    expect(response.status).toBe(409)
  })

  it("does not reveal whether an unowned client exists", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const { POST } = await import("./route")
    const response = await POST(
      post({ clientId: "foreign", name: "Bucket", taskIds: ["task-1"] }),
    )

    expect(response.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
