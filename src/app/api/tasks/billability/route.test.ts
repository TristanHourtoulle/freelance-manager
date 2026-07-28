import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    task: { updateMany: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getAuthUser: () => getAuthUser(),
    requireSameOrigin: () => null,
  }
})

function post(body: Record<string, unknown>) {
  return new Request("http://localhost/api/tasks/billability", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

function updateManyArgs() {
  return prismaMock.task.updateMany.mock.calls[0]![0]
}

describe("POST /api/tasks/billability", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.task.updateMany.mockResolvedValue({ count: 2 })
  })

  it("scopes the update to the authenticated user's tasks", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      post({
        taskIds: ["t1", "t2"],
        billable: false,
        nonBillableReason: "NON_BILLED_WORK",
      }),
    )

    expect(res.status).toBe(200)
    expect(updateManyArgs().where).toEqual({
      id: { in: ["t1", "t2"] },
      userId: "user-1",
    })
  })

  it("applies one shared billability patch and returns the count", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      post({
        taskIds: ["t1", "t2"],
        billable: false,
        nonBillableReason: "BUG_FIX_ALREADY_INVOICED",
      }),
    )
    const body = await res.json()

    expect(body).toEqual({ updated: 2 })
    expect(updateManyArgs().data).toEqual({
      billable: false,
      nonBillableReason: "BUG_FIX_ALREADY_INVOICED",
      nonBillableNote: null,
      nonBillableAt: expect.any(Date),
    })
  })

  it("never touches status nor invoiceId", async () => {
    const { POST } = await import("./route")
    await POST(
      post({
        taskIds: ["t1"],
        billable: false,
        nonBillableReason: "COMMERCIAL_GESTURE",
      }),
    )

    expect(updateManyArgs().data).not.toHaveProperty("status")
    expect(updateManyArgs().data).not.toHaveProperty("invoiceId")
  })

  it("restores billability by clearing reason, note and timestamp", async () => {
    const { POST } = await import("./route")
    await POST(post({ taskIds: ["t1"], billable: true }))

    expect(updateManyArgs().data).toEqual({
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
      nonBillableAt: null,
    })
  })

  it("rejects an empty taskIds array", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      post({ taskIds: [], billable: false, nonBillableReason: "OTHER" }),
    )

    expect(res.status).toBe(400)
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
  })

  it("rejects a batch of more than 500 ids", async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `t${i}`)
    const { POST } = await import("./route")
    const res = await POST(post({ taskIds: ids, billable: true }))

    expect(res.status).toBe(400)
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
  })

  it("rejects a non-billable batch without a reason", async () => {
    const { POST } = await import("./route")
    const res = await POST(post({ taskIds: ["t1"], billable: false }))

    expect(res.status).toBe(400)
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(post({ taskIds: ["t1"], billable: true }))

    expect(res.status).toBe(401)
    expect(prismaMock.task.updateMany).not.toHaveBeenCalled()
  })
})
