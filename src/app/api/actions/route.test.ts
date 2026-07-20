import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    clientAction: { findMany: vi.fn(), create: vi.fn() },
    client: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    meeting: { findFirst: vi.fn() },
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
vi.mock("@/lib/data/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/actions")>()
  return { ...actual, serializeAction: (a: unknown) => a }
})

function request(qs: string) {
  return new Request(`http://localhost/api/actions${qs}`)
}

function where() {
  return prismaMock.clientAction.findMany.mock.calls[0]![0].where
}

describe("GET /api/actions status filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.clientAction.findMany.mockResolvedValue([])
  })

  it("omits the status clause when none is requested", async () => {
    const { GET } = await import("./route")
    await GET(request(""))
    expect(where().status).toBeUndefined()
  })

  it("uses an equality clause for a single status", async () => {
    const { GET } = await import("./route")
    await GET(request("?status=WAITING"))
    expect(where().status).toBe("WAITING")
  })

  it("uses an in clause for a repeated status parameter", async () => {
    const { GET } = await import("./route")
    await GET(request("?status=TODO&status=WAITING"))
    expect(where().status).toEqual({ in: ["TODO", "WAITING"] })
  })

  it("rejects an unknown status instead of forwarding it to Prisma", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?status=BOGUS"))

    expect(res.status).toBe(400)
    expect(prismaMock.clientAction.findMany).not.toHaveBeenCalled()
  })

  it("keeps the client and type filters alongside the status clause", async () => {
    const { GET } = await import("./route")
    await GET(request("?clientId=c1&type=RELANCE&status=TODO"))

    expect(where()).toMatchObject({
      userId: "user-1",
      clientId: "c1",
      type: "RELANCE",
      status: "TODO",
    })
  })
})
