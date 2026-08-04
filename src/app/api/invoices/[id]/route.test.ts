import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    invoice: { findFirst: vi.fn(), update: vi.fn() },
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

vi.mock("@/lib/payments", () => ({
  getInvoiceComputed: vi.fn(),
  recomputeInvoicePayment: vi.fn(),
  serializePayment: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))
vi.mock("@/lib/data/invoices", () => ({
  invoicesTag: (id: string) => `user-${id}-invoices`,
  getInvoicesFirstPage: vi.fn(),
}))
vi.mock("@/lib/data/clients", () => ({
  clientsTag: (id: string) => `user-${id}-clients`,
}))
vi.mock("@/lib/data/nav", () => ({ navTag: (id: string) => `user-${id}-nav` }))
vi.mock("@/lib/invoice-numbering", () => ({ nextAutoNumber: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

const INVOICE_ID = "inv-1"

function patchRequest(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/invoices/${INVOICE_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "DRAFT",
      kind: "STANDARD",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      ...body,
    }),
  })
}

const routeParams = { params: Promise.resolve({ id: INVOICE_ID }) }

describe("PATCH /api/invoices/[id] — task re-binding", () => {
  const tx = {
    task: { findMany: vi.fn(), updateMany: vi.fn() },
    taskGroup: { updateMany: vi.fn() },
    invoiceLine: { deleteMany: vi.fn() },
    invoice: { update: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_APP_URL
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "c1",
      status: "DRAFT",
    })
    prismaMock.$transaction.mockImplementation(
      async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    )
    tx.task.findMany.mockImplementation(async (args) =>
      args.where.id.in.map((id: string) => ({
        id,
        taskGroupId: null,
        status: "PENDING_INVOICE",
        billable: true,
        invoiceId: null,
      })),
    )
  })

  it("returns a removed-line task to the pipeline while a kept-line task stays attached", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({
        lines: [{ taskId: "t-kept", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.task.updateMany).toHaveBeenCalledTimes(2)
    expect(tx.task.updateMany.mock.calls[0]![0]).toEqual({
      where: { invoiceId: INVOICE_ID, userId: "user-1" },
      data: { invoiceId: null, status: "PENDING_INVOICE" },
    })
    expect(tx.task.updateMany.mock.calls[1]![0]).toEqual({
      where: { id: { in: ["t-kept"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: INVOICE_ID, status: "DONE" },
    })
  })

  it("detaches before deleting lines and re-attaching, inside the transaction", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    const detachOrder = tx.task.updateMany.mock.invocationCallOrder[0]!
    const deleteLinesOrder =
      tx.invoiceLine.deleteMany.mock.invocationCallOrder[0]!
    const reattachOrder = tx.task.updateMany.mock.invocationCallOrder[1]!
    expect(detachOrder).toBeLessThan(deleteLinesOrder)
    expect(deleteLinesOrder).toBeLessThan(reattachOrder)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it("re-attaches the deduplicated union of taskIds and line taskIds", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t1", label: "[TRI-1] Dev", qty: 1, rate: 500 }],
        taskIds: ["t1", "t2"],
      }),
      routeParams,
    )

    expect(tx.task.updateMany.mock.calls[1]![0].where.id).toEqual({
      in: ["t1", "t2"],
    })
  })

  it("still re-attaches tasks selected via taskIds without a matching line", async () => {
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ label: "Forfait", qty: 1, rate: 500 }],
        taskIds: ["t2"],
      }),
      routeParams,
    )

    expect(tx.task.updateMany.mock.calls[1]![0]).toEqual({
      where: { id: { in: ["t2"] }, userId: "user-1", clientId: "c1" },
      data: { invoiceId: INVOICE_ID, status: "DONE" },
    })
  })

  it("only detaches when nothing references a task anymore", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({ lines: [{ label: "Forfait", qty: 1, rate: 500 }] }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.task.updateMany).toHaveBeenCalledTimes(1)
    expect(tx.task.updateMany.mock.calls[0]![0].data).toEqual({
      invoiceId: null,
      status: "PENDING_INVOICE",
    })
  })

  it("releases groups removed from the edited invoice", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({
        lines: [{ label: "Audit", qty: 1, rate: 500 }],
        taskGroupIds: [],
      }),
      routeParams,
    )

    expect(res.status).toBe(200)
    expect(tx.taskGroup.updateMany).toHaveBeenCalledWith({
      where: {
        invoiceId: INVOICE_ID,
        userId: "user-1",
        id: { notIn: [] },
      },
      data: { invoiceId: null },
    })
  })

  it("scopes the re-attach query to the authenticated user and invoice client", async () => {
    getAuthUser.mockResolvedValue({ id: "user-9" })
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: INVOICE_ID,
      number: "2026-1001",
      clientId: "c7",
      status: "DRAFT",
    })
    const { PATCH } = await import("./route")
    await PATCH(
      patchRequest({
        lines: [{ taskId: "t-foreign", label: "Dev", qty: 1, rate: 500 }],
      }),
      routeParams,
    )

    const where = tx.task.updateMany.mock.calls[1]![0].where
    expect(where.userId).toBe("user-9")
    expect(where.clientId).toBe("c7")
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)
    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest({ lines: [{ label: "Dev", qty: 1, rate: 500 }] }),
      routeParams,
    )

    expect(res.status).toBe(401)
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})
