import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    task: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
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

  it("narrows the list to every selected client, not just the first", async () => {
    const { GET } = await import("./route")
    await GET(get("?clientIds=c1,c2"))

    expect(findManyWhere().clientId).toEqual({ in: ["c1", "c2"] })
  })

  it("accepts a single id as a one-element list", async () => {
    const { GET } = await import("./route")
    await GET(get("?clientIds=c1"))

    expect(findManyWhere().clientId).toEqual({ in: ["c1"] })
  })

  it("combines client and project narrowing as AND", async () => {
    const { GET } = await import("./route")
    await GET(get("?clientIds=c1,c2&projectIds=p1"))

    const where = findManyWhere()
    expect(where.clientId).toEqual({ in: ["c1", "c2"] })
    expect(where.projectId).toEqual({ in: ["p1"] })
  })

  it("treats an empty clientIds param as no narrowing, not an empty IN ()", async () => {
    const { GET } = await import("./route")
    await GET(get("?clientIds="))

    expect(findManyWhere()).not.toHaveProperty("clientId")
  })

  it("does not narrow by client or project by default", async () => {
    const { GET } = await import("./route")
    await GET(get())

    const where = findManyWhere()
    expect(where).not.toHaveProperty("clientId")
    expect(where).not.toHaveProperty("projectId")
  })

  it("rejects an oversized clientIds list with a 400", async () => {
    const oversized = Array.from({ length: 201 }, (_, i) => `c${i}`).join(",")
    const { GET } = await import("./route")
    const res = await GET(get(`?clientIds=${oversized}`))

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

describe("GET /api/tasks?summary=status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.$queryRaw.mockResolvedValue([
      {
        all: 137,
        pending: 80,
        done: 40,
        inProgress: 17,
        invoiced: 61,
        nonBillable: 9,
        unestimated: 52,
      },
    ])
  })

  it("returns uncapped counts from a database aggregate, never from fetched rows", async () => {
    const { GET } = await import("./route")
    const res = await GET(get("?summary=status"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    expect(prismaMock.task.findMany).not.toHaveBeenCalled()
    expect(body).toEqual({
      all: 137,
      pending: 80,
      done: 40,
      in_progress: 17,
      invoiced: 61,
      non_billable: 9,
      unestimatedCount: 52,
    })
  })

  it("scopes the aggregate to the authenticated user", async () => {
    const { GET } = await import("./route")
    await GET(get("?summary=status"))

    const values = prismaMock.$queryRaw.mock.calls[0]!.slice(1)
    expect(values[0]).toBe("user-1")
  })

  it("forwards multi-select clientIds and projectIds narrowing to the aggregate", async () => {
    const { GET } = await import("./route")
    await GET(get("?summary=status&clientIds=c1,c2&projectIds=p1"))

    const values = prismaMock.$queryRaw.mock.calls[0]!.slice(1)
    expect(values).toEqual([
      "user-1",
      ["c1", "c2"],
      ["c1", "c2"],
      ["p1"],
      ["p1"],
    ])
  })

  it("treats an empty clientIds param as no narrowing", async () => {
    const { GET } = await import("./route")
    await GET(get("?summary=status&clientIds="))

    const values = prismaMock.$queryRaw.mock.calls[0]!.slice(1)
    expect(values).toEqual(["user-1", null, null, null, null])
  })

  it("rejects an oversized clientIds list without touching the database", async () => {
    const oversized = Array.from({ length: 201 }, (_, i) => `c${i}`).join(",")
    const { GET } = await import("./route")
    const res = await GET(get(`?summary=status&clientIds=${oversized}`))

    expect(res.status).toBe(400)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it("rejects an unknown summary mode without touching the database", async () => {
    const { GET } = await import("./route")
    const res = await GET(get("?summary=everything"))

    expect(res.status).toBe(400)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
    expect(prismaMock.task.findMany).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(get("?summary=status"))

    expect(res.status).toBe(401)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })
})
