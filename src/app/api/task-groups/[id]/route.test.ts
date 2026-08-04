import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, getAuthUser } = vi.hoisted(() => ({
  prismaMock: {
    taskGroup: { findFirst: vi.fn() },
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
  taskGroup: { updateMany: vi.fn(), deleteMany: vi.fn() },
}

const params = { params: Promise.resolve({ id: "group-1" }) }

function request(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
  return new Request("http://localhost/api/task-groups/group-1", {
    method,
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe("/api/task-groups/[id] guardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.taskGroup.findFirst.mockResolvedValue({
      id: "group-1",
      clientId: "client-1",
      invoiceId: null,
    })
    tx.task.findMany.mockResolvedValue([{ id: "task-1" }, { id: "task-2" }])
    tx.task.updateMany.mockResolvedValue({ count: 2 })
    tx.taskGroup.updateMany.mockResolvedValue({ count: 1 })
    tx.taskGroup.deleteMany.mockResolvedValue({ count: 1 })
    prismaMock.$transaction.mockImplementation(
      async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    )
  })

  it("allows only same-client unbilled tasks that are free or already in this group", async () => {
    const { PATCH } = await import("./route")
    const response = await PATCH(
      request("PATCH", {
        name: "Bucket & CDN v2",
        taskIds: ["task-1", "task-2"],
      }),
      params,
    )

    expect(response.status).toBe(200)
    expect(tx.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          clientId: "client-1",
          invoiceId: null,
          OR: [{ taskGroupId: null }, { taskGroupId: "group-1" }],
        }),
      }),
    )
  })

  it("rejects a task already owned by another group", async () => {
    tx.task.findMany.mockResolvedValue([{ id: "task-1" }])
    const { PATCH } = await import("./route")
    const response = await PATCH(
      request("PATCH", {
        name: "Bucket & CDN",
        taskIds: ["task-1", "task-in-other-group"],
      }),
      params,
    )

    expect(response.status).toBe(409)
    expect(tx.taskGroup.updateMany).toHaveBeenCalledTimes(1)
  })

  it("locks a group as soon as it belongs to an invoice", async () => {
    prismaMock.taskGroup.findFirst.mockResolvedValue({
      id: "group-1",
      clientId: "client-1",
      invoiceId: "invoice-1",
    })
    const { PATCH, DELETE } = await import("./route")

    const patchResponse = await PATCH(
      request("PATCH", { name: "Nope", taskIds: ["task-1"] }),
      params,
    )
    const deleteResponse = await DELETE(request("DELETE"), params)

    expect(patchResponse.status).toBe(409)
    expect(deleteResponse.status).toBe(409)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("releases every task before deleting an unbilled group", async () => {
    const { DELETE } = await import("./route")
    const response = await DELETE(request("DELETE"), params)

    expect(response.status).toBe(200)
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { taskGroupId: "group-1", userId: "user-1" },
      data: { taskGroupId: null },
    })
    expect(tx.taskGroup.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "group-1",
        userId: "user-1",
        invoiceId: null,
      },
    })
  })
})
