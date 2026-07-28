import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, txMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  txMock: {
    invoice: { create: vi.fn() },
    task: { updateMany: vi.fn() },
    client: { update: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

const nextAutoNumber = vi.fn()
vi.mock("@/lib/invoice-numbering", () => ({
  nextAutoNumber: (...args: unknown[]) => nextAutoNumber(...args),
}))

import { revalidateTag } from "next/cache"
import { createInvoiceDraft, getInvoice, listInvoices } from "./invoices"

const USER_ID = "user-1"

type DraftArgs = Parameters<typeof createInvoiceDraft>[1]

function draftArgs(overrides: Partial<DraftArgs> = {}): DraftArgs {
  return {
    clientId: "client-1",
    kind: "STANDARD",
    issueDate: "2026-07-28",
    dueDate: "2026-08-27",
    lines: [
      { label: "[TRI-1] Feature", qty: 2, rate: 500 },
      { label: "[TRI-2] Fix", qty: 1, rate: 250 },
    ],
    ...overrides,
  }
}

function createdInvoiceRow() {
  return {
    id: "inv-1",
    number: "2026-1025",
    clientId: "client-1",
    projectId: null,
  }
}

function auditTitles(): string[] {
  return prismaMock.activityLog.create.mock.calls.map(
    (call) => (call[0] as { data: { title: string } }).data.title,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
  prismaMock.client.findFirst.mockResolvedValue({
    id: "client-1",
    stage: "ACTIVE",
  })
  prismaMock.project.findFirst.mockResolvedValue({ id: "proj-1" })
  prismaMock.invoice.count.mockResolvedValue(0)
  prismaMock.invoice.findFirst.mockResolvedValue(null)
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
  txMock.invoice.create.mockResolvedValue(createdInvoiceRow())
  txMock.task.updateMany.mockResolvedValue({ count: 0 })
  nextAutoNumber.mockResolvedValue("2026-1025")
})

describe("createInvoiceDraft", () => {
  it("forces status DRAFT even when the input claims SENT", async () => {
    const args = {
      ...draftArgs(),
      status: "SENT",
    } as unknown as DraftArgs
    const result = await createInvoiceDraft(USER_ID, args)
    expect(result.isError).toBeUndefined()
    const data = txMock.invoice.create.mock.calls[0]![0].data as {
      status: string
    }
    expect(data.status).toBe("DRAFT")
    expect((result.structuredContent as { status: string }).status).toBe(
      "DRAFT",
    )
  })

  it("computes the total from the lines and ignores a supplied total", async () => {
    const args = {
      ...draftArgs(),
      total: 999_999,
      totalOverride: 999_999,
    } as unknown as DraftArgs
    const result = await createInvoiceDraft(USER_ID, args)
    const data = txMock.invoice.create.mock.calls[0]![0].data as {
      subtotal: number
      total: number
      totalOverride: null
    }
    expect(data.subtotal).toBe(1250)
    expect(data.total).toBe(1250)
    expect(data.totalOverride).toBeNull()
    expect((result.structuredContent as { total: number }).total).toBe(1250)
  })

  it("allocates the invoice number inside the transaction", async () => {
    await createInvoiceDraft(USER_ID, draftArgs())
    expect(nextAutoNumber).toHaveBeenCalledWith(txMock, USER_ID, 2026)
    const data = txMock.invoice.create.mock.calls[0]![0].data as {
      number: string
    }
    expect(data.number).toBe("2026-1025")
  })

  it("rejects a DEPOSIT draft with two lines as an isError result", async () => {
    const result = await createInvoiceDraft(
      USER_ID,
      draftArgs({ kind: "DEPOSIT" }),
    )
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "A DEPOSIT invoice must have exactly one line",
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(auditTitles()[0]).toContain("(erreur)")
  })

  it("scopes attached tasks to the principal and the client", async () => {
    await createInvoiceDraft(
      USER_ID,
      draftArgs({
        taskIds: ["task-1"],
        lines: [{ taskId: "task-2", label: "L", qty: 1, rate: 100 }],
      }),
    )
    expect(txMock.task.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["task-1", "task-2"] },
        userId: USER_ID,
        clientId: "client-1",
      },
      data: { invoiceId: "inv-1", status: "DONE" },
    })
  })

  it("returns not-found for a client owned by another user", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await createInvoiceDraft(USER_ID, draftArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Client not found" })
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1", userId: USER_ID },
      }),
    )
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("revalidates the invoice, client and nav caches and writes the audit row", async () => {
    await createInvoiceDraft(USER_ID, draftArgs())
    expect(revalidateTag).toHaveBeenCalledWith("user-user-1-invoices", "max")
    expect(revalidateTag).toHaveBeenCalledWith("user-user-1-clients", "max")
    expect(revalidateTag).toHaveBeenCalledWith("user-user-1-nav", "max")
    expect(auditTitles()[0]).toBe("Appel MCP create_invoice_draft (succès)")
  })
})

describe("listInvoices / getInvoice", () => {
  it("scopes the invoice list to the principal and writes an audit row", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([])
    const result = await listInvoices(USER_ID, {
      limit: 25,
      fetchAll: false,
    })
    expect(result.isError).toBeUndefined()
    const call = prismaMock.invoice.findMany.mock.calls[0]![0] as {
      where: { userId: string }
    }
    expect(call.where.userId).toBe(USER_ID)
    expect(auditTitles()[0]).toBe("Appel MCP list_invoices (succès)")
  })

  it("returns the uncapped total from a real count(), not rows.length", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([])
    prismaMock.invoice.count.mockResolvedValue(137)
    const result = await listInvoices(USER_ID, {
      limit: 25,
      fetchAll: false,
    })
    const { total } = result.structuredContent as { total: number }
    expect(total).toBe(137)
  })

  it("returns not-found for a foreign invoice id, never data", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null)
    const result = await getInvoice(USER_ID, { invoiceId: "someone-elses" })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Invoice not found" })
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "someone-elses", userId: USER_ID },
      }),
    )
  })
})
