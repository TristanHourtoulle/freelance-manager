import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    task: { findFirst: vi.fn(), update: vi.fn() },
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

const params = { params: Promise.resolve({ id: "t1" }) }

function patch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/tasks/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

function updateData() {
  return prismaMock.task.update.mock.calls[0]![0].data
}

describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1" })
    prismaMock.task.update.mockResolvedValue({
      id: "t1",
      linearIssueId: "issue-1",
      linearIdentifier: "TRI-1",
      title: "Task one",
      status: "PENDING_INVOICE",
      priority: "NONE",
      estimate: null,
      actualDays: null,
      completedAt: null,
      invoiceId: null,
      clientId: "c1",
      projectId: "p1",
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
    })
  })

  it("writes actualDays alone without touching billability", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ actualDays: 2.5 }), params)

    expect(res.status).toBe(200)
    expect(updateData()).toEqual({ actualDays: 2.5 })
  })

  it("marks a task non-billable with reason, note and timestamp", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patch({
        billability: {
          billable: false,
          nonBillableReason: "COMMERCIAL_GESTURE",
          nonBillableNote: "  offert  ",
        },
      }),
      params,
    )

    expect(res.status).toBe(200)
    expect(updateData()).toEqual({
      billable: false,
      nonBillableReason: "COMMERCIAL_GESTURE",
      nonBillableNote: "offert",
      nonBillableAt: expect.any(Date),
    })
  })

  it("flipping back to billable clears reason, note and timestamp", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ billability: { billable: true } }), params)

    expect(res.status).toBe(200)
    expect(updateData()).toEqual({
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
      nonBillableAt: null,
    })
  })

  it("returns billability fields in the response body", async () => {
    prismaMock.task.update.mockResolvedValue({
      id: "t1",
      linearIssueId: "issue-1",
      linearIdentifier: "TRI-1",
      title: "Task one",
      status: "PENDING_INVOICE",
      priority: "NONE",
      estimate: null,
      actualDays: null,
      completedAt: null,
      invoiceId: null,
      clientId: "c1",
      projectId: "p1",
      billable: false,
      nonBillableReason: "NON_BILLED_WORK",
      nonBillableNote: null,
    })
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patch({
        billability: { billable: false, nonBillableReason: "NON_BILLED_WORK" },
      }),
      params,
    )
    const body = await res.json()

    expect(body.billable).toBe(false)
    expect(body.nonBillableReason).toBe("NON_BILLED_WORK")
    expect(body.nonBillableNote).toBeNull()
  })

  it("rejects a billable task carrying a reason", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patch({
        billability: { billable: true, nonBillableReason: "OTHER" },
      }),
      params,
    )

    expect(res.status).toBe(400)
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })

  it("rejects a non-billable task without a reason", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ billability: { billable: false } }), params)

    expect(res.status).toBe(400)
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })

  it("rejects the OTHER reason without a note", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patch({ billability: { billable: false, nonBillableReason: "OTHER" } }),
      params,
    )

    expect(res.status).toBe(400)
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ actualDays: 1 }), params)

    expect(res.status).toBe(401)
  })

  it("returns 404 when the task belongs to another user", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null)
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ actualDays: 1 }), params)

    expect(res.status).toBe(404)
    expect(prismaMock.task.update).not.toHaveBeenCalled()
  })
})
