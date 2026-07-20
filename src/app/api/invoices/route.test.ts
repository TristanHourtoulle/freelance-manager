import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findMany: vi.fn() },
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

const getInvoicesFirstPage = vi.fn()
vi.mock("@/lib/data/invoices", () => ({
  invoicesTag: (id: string) => `user-${id}-invoices`,
  getInvoicesFirstPage: () => getInvoicesFirstPage(),
}))
vi.mock("@/domain/billing/serialize", () => ({
  serializeInvoice: (inv: { id: string; number: string }) => ({
    id: inv.id,
    number: inv.number,
  }),
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("@/lib/payments", () => ({ recomputeInvoicePayment: vi.fn() }))
vi.mock("@/lib/invoice-numbering", () => ({ nextAutoNumber: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const ROWS = [
  {
    id: "i1",
    number: "FAC-2026-042",
    client: { firstName: "Jean", lastName: "Dupont", company: "Acme SAS" },
  },
  {
    id: "i2",
    number: "FAC-2026-043",
    client: { firstName: "Bob", lastName: "Martin", company: null },
  },
]

function request(qs: string) {
  return new Request(`http://localhost/api/invoices${qs}`)
}

describe("GET /api/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    getInvoicesFirstPage.mockResolvedValue({
      data: [],
      nextCursor: null,
      hasMore: false,
    })
    prismaMock.invoice.findMany.mockResolvedValue(ROWS)
  })

  it("serves the cached first page when no search term is given", async () => {
    const { GET } = await import("./route")
    const res = await GET(request(""))

    expect(res.status).toBe(200)
    expect(getInvoicesFirstPage).toHaveBeenCalledTimes(1)
    expect(prismaMock.invoice.findMany).not.toHaveBeenCalled()
  })

  it("keeps the response shape unchanged when paginating without a term", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?cursor=i0&limit=50"))
    const body = await res.json()

    expect(prismaMock.invoice.findMany.mock.calls[0]![0].where).toEqual({
      userId: "user-1",
    })
    expect(body.data).toEqual([
      { id: "i1", number: "FAC-2026-042" },
      { id: "i2", number: "FAC-2026-043" },
    ])
  })

  it("matches the invoice number and the related client name, case-insensitively", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?q=AcMe&limit=6"))

    expect(res.status).toBe(200)
    const where = prismaMock.invoice.findMany.mock.calls[0]![0].where
    expect(where.OR).toEqual([
      { number: { contains: "AcMe", mode: "insensitive" } },
      {
        client: {
          OR: [
            { firstName: { contains: "AcMe", mode: "insensitive" } },
            { lastName: { contains: "AcMe", mode: "insensitive" } },
            { company: { contains: "AcMe", mode: "insensitive" } },
          ],
        },
      },
    ])
  })

  it("labels search hits with their client name", async () => {
    const { GET } = await import("./route")
    const res = await GET(request("?q=acme&limit=6"))
    const body = await res.json()

    expect(body.data).toEqual([
      { id: "i1", number: "FAC-2026-042", clientName: "Acme SAS" },
      { id: "i2", number: "FAC-2026-043", clientName: "Bob Martin" },
    ])
  })

  it("keeps search results scoped to the authenticated user", async () => {
    getAuthUser.mockResolvedValue({ id: "user-2" })
    const { GET } = await import("./route")
    await GET(request("?q=acme&limit=6"))

    const where = prismaMock.invoice.findMany.mock.calls[0]![0].where
    expect(where.userId).toBe("user-2")
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(request("?q=acme"))

    expect(res.status).toBe(401)
    expect(prismaMock.invoice.findMany).not.toHaveBeenCalled()
  })
})
