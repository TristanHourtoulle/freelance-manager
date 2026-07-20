import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    client: { findFirst: vi.fn() },
    task: { findMany: vi.fn() },
    meeting: { findMany: vi.fn() },
    clientAction: { findMany: vi.fn() },
    invoice: { findMany: vi.fn(), findFirst: vi.fn() },
    payment: { findMany: vi.fn(), findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: () => getAuthUser() }
})

vi.mock("@react-pdf/renderer", () => ({
  renderToStream: vi.fn(async () => new ReadableStream()),
  Document: () => null,
  Page: () => null,
  StyleSheet: { create: (s: unknown) => s },
  Text: () => null,
  View: () => null,
}))

function request(qs = "") {
  return new Request(`http://localhost/api/clients/c1/client-recap${qs}`)
}

const params = { params: Promise.resolve({ id: "c1" }) }

describe("GET /api/clients/[id]/client-recap", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.client.findFirst.mockResolvedValue({
      firstName: "Henri",
      lastName: "Mistral",
      company: "Mistral SAS",
    })
    prismaMock.task.findMany.mockResolvedValue([])
    prismaMock.meeting.findMany.mockResolvedValue([])
    prismaMock.clientAction.findMany.mockResolvedValue([])
  })

  it("rejects an unauthenticated caller", async () => {
    getAuthUser.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(request(), params)
    expect(res.status).toBe(401)
  })

  it("answers 404 when the client belongs to someone else", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const { GET } = await import("./route")
    const res = await GET(request(), params)
    expect(res.status).toBe(404)
  })

  it("never reads invoices or payments", async () => {
    const { GET } = await import("./route")
    await GET(request(), params)

    expect(prismaMock.invoice.findMany).not.toHaveBeenCalled()
    expect(prismaMock.invoice.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled()
    expect(prismaMock.payment.findFirst).not.toHaveBeenCalled()
  })

  it("selects no private business field on the client row", async () => {
    const { GET } = await import("./route")
    await GET(request(), params)

    const select = prismaMock.client.findFirst.mock.calls[0]![0].select
    expect(Object.keys(select).sort()).toEqual([
      "company",
      "firstName",
      "lastName",
    ])
  })

  it("names the download with the client-facing prefix", async () => {
    const { GET } = await import("./route")
    const res = await GET(request(), params)

    expect(res.headers.get("Content-Disposition")).toContain("recap-client-")
  })

  it("only considers open follow-up actions", async () => {
    const { GET } = await import("./route")
    await GET(request(), params)

    const where = prismaMock.clientAction.findMany.mock.calls[0]![0].where
    expect(where.status).toEqual({ in: ["TODO", "WAITING"] })
  })
})
