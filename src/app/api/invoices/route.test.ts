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
vi.mock("@/lib/data/clients", () => ({
  clientsTag: (id: string) => `user-${id}-clients`,
}))
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

describe("POST /api/invoices — client stage promotion", () => {
  const tx = {
    invoice: { create: vi.fn(), findFirst: vi.fn() },
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn() },
    client: { update: vi.fn() },
  }

  function postRequest() {
    return new Request("http://localhost/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "c1",
        status: "DRAFT",
        kind: "STANDARD",
        issueDate: "2026-03-01",
        dueDate: "2026-03-31",
        lines: [{ label: "Dev", qty: 1, rate: 500 }],
      }),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    tx.invoice.create.mockResolvedValue({
      id: "i9",
      number: "2026-1025",
      clientId: "c1",
    })
    tx.invoice.findFirst.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    )
  })

  it("promotes a LEAD client to ACTIVE inside the transaction", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1", stage: "LEAD" })
    const { POST } = await import("./route")
    const res = await POST(postRequest())

    expect(res.status).toBe(201)
    expect(tx.client.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { stage: "ACTIVE" },
    })
  })

  it("leaves an already ACTIVE client untouched", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1", stage: "ACTIVE" })
    const { POST } = await import("./route")
    const res = await POST(postRequest())

    expect(res.status).toBe(201)
    expect(tx.client.update).not.toHaveBeenCalled()
  })
})

describe("POST /api/invoices — task attachment", () => {
  const tx = {
    invoice: { create: vi.fn(), findFirst: vi.fn() },
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    payment: { create: vi.fn() },
    client: { update: vi.fn() },
  }

  function postRequest(body: Record<string, unknown>) {
    return new Request("http://localhost/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: "c1",
        status: "DRAFT",
        kind: "STANDARD",
        issueDate: "2026-03-01",
        dueDate: "2026-03-31",
        ...body,
      }),
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1", stage: "ACTIVE" })
    tx.invoice.create.mockResolvedValue({
      id: "i9",
      number: "2026-1025",
      clientId: "c1",
    })
    tx.invoice.findFirst.mockResolvedValue(null)
    tx.task.findMany.mockImplementation(async (args) =>
      args.where.id.in.map((id: string) => ({
        id,
        taskGroupId: null,
        status: "PENDING_INVOICE",
        billable: true,
        invoiceId: null,
      })),
    )
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    )
  })

  it("attaches a task referenced only by a line, even without taskIds", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        lines: [{ taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
        taskIds: [],
      }),
    )

    expect(res.status).toBe(201)
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: "i9", status: "DONE" },
    })
  })

  it("rejects invoicing a grouped task as a standalone task", async () => {
    tx.task.findMany.mockResolvedValue([
      {
        id: "t1",
        taskGroupId: "g1",
        status: "PENDING_INVOICE",
        billable: true,
        invoiceId: null,
      },
    ])
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        lines: [{ taskId: "t1", label: "Images", qty: 1, rate: 500 }],
      }),
    )

    expect(res.status).toBe(409)
    expect(tx.invoice.create).not.toHaveBeenCalled()
  })

  it("still attaches tasks selected via taskIds without a matching line", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        lines: [{ label: "Forfait", qty: 1, rate: 500 }],
        taskIds: ["t1"],
      }),
    )

    expect(res.status).toBe(201)
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["t1"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: "i9", status: "DONE" },
    })
  })

  it("deduplicates a task referenced by both taskIds and a line", async () => {
    const { POST } = await import("./route")
    await POST(
      postRequest({
        lines: [
          { taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 },
          { taskId: "t2", label: "[TRI-2] Fix", qty: 2, rate: 500 },
        ],
        taskIds: ["t1"],
      }),
    )

    expect(tx.task.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.task.updateMany.mock.calls[0]![0].where.id).toEqual({
      in: ["t1", "t2"],
    })
  })

  it("scopes the attach query to the authenticated user and invoice client", async () => {
    getAuthUser.mockResolvedValue({ id: "user-9" })
    prismaMock.client.findFirst.mockResolvedValue({ id: "c1", stage: "ACTIVE" })
    const { POST } = await import("./route")
    await POST(
      postRequest({
        lines: [{ taskId: "t-foreign", label: "Dev", qty: 1, rate: 500 }],
      }),
    )

    const where = tx.task.updateMany.mock.calls[0]![0].where
    expect(where.userId).toBe("user-9")
    expect(where.clientId).toBe("c1")
  })

  it("skips the attach query when nothing references a task", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ lines: [{ label: "Forfait", qty: 1, rate: 500 }] }),
    )

    expect(res.status).toBe(201)
    expect(tx.task.updateMany).not.toHaveBeenCalled()
  })
})
