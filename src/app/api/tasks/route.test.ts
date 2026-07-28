import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    task: { findMany: vi.fn() },
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
  }
})

function get(query = "") {
  return new Request(`http://localhost/api/tasks${query}`)
}

function findManyWhere() {
  return prismaMock.task.findMany.mock.calls[0]![0].where
}

function taskRow() {
  return {
    id: "t1",
    linearIssueId: "issue-1",
    linearIdentifier: "TRI-1",
    linearUrl: null,
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
    nonBillableReason: "COMMERCIAL_GESTURE",
    nonBillableNote: "offert",
  }
}

describe("GET /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.task.findMany.mockResolvedValue([taskRow()])
  })

  it("exposes the billability fields in the DTO", async () => {
    const { GET } = await import("./route")
    const res = await GET(get())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data[0]).toMatchObject({
      id: "t1",
      billable: false,
      nonBillableReason: "COMMERCIAL_GESTURE",
      nonBillableNote: "offert",
    })
  })

  it("does not filter on billability by default", async () => {
    const { GET } = await import("./route")
    await GET(get())

    expect(findManyWhere()).not.toHaveProperty("billable")
  })

  it("filters on billable=false", async () => {
    const { GET } = await import("./route")
    await GET(get("?billable=false"))

    expect(findManyWhere().billable).toBe(false)
  })

  it("filters on billable=true", async () => {
    const { GET } = await import("./route")
    await GET(get("?billable=true"))

    expect(findManyWhere().billable).toBe(true)
  })

  it("rejects a malformed billable value", async () => {
    const { GET } = await import("./route")
    const res = await GET(get("?billable=oui"))

    expect(res.status).toBe(400)
    expect(prismaMock.task.findMany).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(get())

    expect(res.status).toBe(401)
  })
})
