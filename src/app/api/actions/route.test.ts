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

function getRequest(qs: string) {
  return new Request(`http://localhost/api/actions${qs}`)
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/actions", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("/api/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.clientAction.findMany.mockResolvedValue([])
    prismaMock.clientAction.create.mockResolvedValue({ id: "a1" })
    prismaMock.client.findFirst.mockResolvedValue({ id: "abc" })
  })

  it("creates an unclassified action without checking client ownership", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest({ title: "Appel client" }))

    expect(res.status).toBe(201)
    expect(prismaMock.client.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.clientAction.create.mock.calls[0]![0].data.clientId).toBe(
      null,
    )
  })

  it("404s when the client is not owned by the user", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const { POST } = await import("./route")
    const res = await POST(postRequest({ title: "Appel", clientId: "other" }))

    expect(res.status).toBe(404)
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("400s when an invoice is linked without a client", async () => {
    const { POST } = await import("./route")
    const res = await POST(postRequest({ title: "Relance", invoiceId: "inv1" }))

    expect(res.status).toBe(400)
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("filters on a null client for the none sentinel", async () => {
    const { GET } = await import("./route")
    await GET(getRequest("?clientId=none"))

    const where = prismaMock.clientAction.findMany.mock.calls[0]![0].where
    expect(where.clientId).toBe(null)
  })

  it("filters on the given client id", async () => {
    const { GET } = await import("./route")
    await GET(getRequest("?clientId=abc"))

    const where = prismaMock.clientAction.findMany.mock.calls[0]![0].where
    expect(where.clientId).toBe("abc")
  })

  it("omits the client filter entirely when none is given", async () => {
    const { GET } = await import("./route")
    await GET(getRequest(""))

    const where = prismaMock.clientAction.findMany.mock.calls[0]![0].where
    expect("clientId" in where).toBe(false)
  })
})
