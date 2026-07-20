import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { client: { findMany: vi.fn(), create: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

const getClientsFirstPage = vi.fn()
const getClientsRecencySummary = vi.fn()
vi.mock("@/lib/data/clients", () => ({
  clientsTag: (id: string) => `user-${id}-clients`,
  getClientsBillableSummary: vi.fn(),
  getClientsFirstPage: () => getClientsFirstPage(),
  getClientsRecencySummary: (id: string) => getClientsRecencySummary(id),
  serializeClient: (c: unknown) => c,
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const ROWS = [
  { id: "c1", firstName: "Acme", lastName: "Corp", company: "Acme SAS" },
]

function request(qs: string) {
  return new Request(`http://localhost/api/clients${qs}`)
}

describe("GET /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    getClientsFirstPage.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
    })
    prismaMock.client.findMany.mockResolvedValue(ROWS)
    getClientsRecencySummary.mockResolvedValue({ byClient: {} })
  })

  it("serves the cached first page when no search term is given", async () => {
    const { GET } = await import("./route")
    const res = await GET(request(""))

    expect(res.status).toBe(200)
    expect(getClientsFirstPage).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  it("keeps the unfiltered where clause when paginating without a term", async () => {
    const { GET } = await import("./route")
    await GET(request("?cursor=c0&limit=50"))

    const where = prismaMock.client.findMany.mock.calls[0]![0].where
    expect(where).toEqual({ userId: "user-1", archivedAt: null })
    expect(where.OR).toBeUndefined()
  })

  it("filters case-insensitively on the name fields when q is given", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?q=AcMe&limit=6"))

    expect(res.status).toBe(200)
    expect(getClientsFirstPage).not.toHaveBeenCalled()

    const where = prismaMock.client.findMany.mock.calls[0]![0].where
    expect(where.OR).toEqual([
      { firstName: { contains: "AcMe", mode: "insensitive" } },
      { lastName: { contains: "AcMe", mode: "insensitive" } },
      { company: { contains: "AcMe", mode: "insensitive" } },
      { email: { contains: "AcMe", mode: "insensitive" } },
    ])
  })

  it("keeps search results scoped to the authenticated user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-2" })
    const { GET } = await import("./route")
    await GET(request("?q=acme&limit=6"))

    const where = prismaMock.client.findMany.mock.calls[0]![0].where
    expect(where.userId).toBe("user-2")
  })

  it("treats a blank search term as absent", async () => {
    const { GET } = await import("./route")
    await GET(request("?q=%20%20"))

    expect(getClientsFirstPage).toHaveBeenCalledTimes(1)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  it("rejects an over-long search term with a 400", async () => {
    const { GET } = await import("./route")
    const res = await GET(request(`?q=${"a".repeat(200)}`))

    expect(res.status).toBe(400)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  it("serves the recency aggregate without touching the cached first page", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?summary=recency"))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ byClient: {} })
    expect(getClientsRecencySummary).toHaveBeenCalledWith("user-1")
    expect(getClientsFirstPage).not.toHaveBeenCalled()
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })

  it("rejects an unknown summary value instead of running an aggregate", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?summary=bogus"))

    expect(res.status).toBe(400)
    expect(getClientsRecencySummary).not.toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(request("?q=acme"))

    expect(res.status).toBe(401)
    expect(prismaMock.client.findMany).not.toHaveBeenCalled()
  })
})
