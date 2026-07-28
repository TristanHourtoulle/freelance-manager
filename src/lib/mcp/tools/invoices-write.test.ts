import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, txMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findFirst: vi.fn() },
    project: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: {
    invoice: { create: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn() },
    invoiceLine: { deleteMany: vi.fn() },
    payment: { create: vi.fn(), aggregate: vi.fn() },
    task: { updateMany: vi.fn() },
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

const recomputeInvoicePayment = vi.fn()
vi.mock("@/lib/payments", () => ({
  recomputeInvoicePayment: (...args: unknown[]) =>
    recomputeInvoicePayment(...args),
}))

import {
  recordPayment,
  splitInvoice,
  updateInvoiceDraft,
} from "./invoices-write"

const USER_ID = "user-1"

type UpdateArgs = Parameters<typeof updateInvoiceDraft>[1]
type SplitArgs = Parameters<typeof splitInvoice>[1]
type PaymentArgs = Parameters<typeof recordPayment>[1]

function updateArgs(overrides: Partial<UpdateArgs> = {}): UpdateArgs {
  return {
    invoiceId: "inv-1",
    kind: "STANDARD",
    issueDate: "2026-07-28",
    dueDate: "2026-08-27",
    lines: [{ label: "[TRI-1] Feature", qty: 2, rate: 500 }],
    ...overrides,
  }
}

function splitArgs(overrides: Partial<SplitArgs> = {}): SplitArgs {
  return {
    clientId: "client-1",
    kind: "STANDARD",
    issueDate: "2026-07-28",
    dueDate: "2026-08-27",
    lines: [{ label: "[TRI-1] Feature", qty: 1, rate: 1000 }],
    parts: 3,
    schedule: "MONTHLY",
    ...overrides,
  }
}

function paymentArgs(overrides: Partial<PaymentArgs> = {}): PaymentArgs {
  return {
    invoiceId: "inv-1",
    amount: 100,
    paidAt: "2026-07-28",
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
  prismaMock.client.findFirst.mockResolvedValue({
    id: "client-1",
    stage: "ACTIVE",
  })
  prismaMock.project.findFirst.mockResolvedValue({ id: "proj-1" })
  prismaMock.invoice.findFirst.mockResolvedValue(null)
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock),
  )
  txMock.invoice.create.mockResolvedValue({
    id: "inv-1",
    number: "2026-1025",
  })
  txMock.invoice.update.mockResolvedValue({})
  txMock.invoice.findUniqueOrThrow.mockResolvedValue({ total: 100 })
  txMock.invoiceLine.deleteMany.mockResolvedValue({ count: 0 })
  txMock.payment.create.mockResolvedValue({
    id: "pay-1",
    amount: 100,
    paidAt: new Date("2026-07-28"),
  })
  txMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 100 } })
  txMock.task.updateMany.mockResolvedValue({ count: 0 })
  nextAutoNumber.mockResolvedValue("2026-1025")
  recomputeInvoicePayment.mockResolvedValue("PARTIALLY_PAID")
})

describe("updateInvoiceDraft", () => {
  it("refuses a SENT invoice as an isError result", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      number: "2026-0001",
      clientId: "client-1",
      status: "SENT",
    })
    const result = await updateInvoiceDraft(USER_ID, updateArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      text: "Only a DRAFT invoice can be edited with update_invoice_draft",
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("recomputes the total from the lines and ignores a supplied total", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      number: "2026-0001",
      clientId: "client-1",
      status: "DRAFT",
    })
    const args = {
      ...updateArgs({
        lines: [
          { label: "A", qty: 2, rate: 300 },
          { label: "B", qty: 1, rate: 100 },
        ],
      }),
      total: 999_999,
    } as unknown as UpdateArgs
    const result = await updateInvoiceDraft(USER_ID, args)
    expect(result.isError).toBeUndefined()
    const data = txMock.invoice.update.mock.calls[0]![0].data as {
      subtotal: number
      total: number
    }
    expect(data.subtotal).toBe(700)
    expect(data.total).toBe(700)
    expect((result.structuredContent as { total: number }).total).toBe(700)
  })

  it("honors totalOverride instead of the lines sum", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      number: "2026-0001",
      clientId: "client-1",
      status: "DRAFT",
    })
    await updateInvoiceDraft(USER_ID, updateArgs({ totalOverride: 42 }))
    const data = txMock.invoice.update.mock.calls[0]![0].data as {
      total: number
      totalOverride: number
    }
    expect(data.total).toBe(42)
    expect(data.totalOverride).toBe(42)
  })

  it("detaches previously attached tasks then reattaches the resolved set", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      number: "2026-0001",
      clientId: "client-1",
      status: "DRAFT",
    })
    await updateInvoiceDraft(
      USER_ID,
      updateArgs({
        taskIds: ["task-1"],
        lines: [{ taskId: "task-2", label: "L", qty: 1, rate: 100 }],
      }),
    )
    expect(txMock.task.updateMany).toHaveBeenNthCalledWith(1, {
      where: { invoiceId: "inv-1", userId: USER_ID },
      data: { invoiceId: null, status: "PENDING_INVOICE" },
    })
    expect(txMock.task.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["task-1", "task-2"] },
        userId: USER_ID,
        clientId: "client-1",
      },
      data: { invoiceId: "inv-1", status: "DONE" },
    })
  })

  it("calls recomputeInvoicePayment inside the transaction", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      number: "2026-0001",
      clientId: "client-1",
      status: "DRAFT",
    })
    await updateInvoiceDraft(USER_ID, updateArgs())
    expect(recomputeInvoicePayment).toHaveBeenCalledWith("inv-1", txMock)
  })

  it("returns not-found for a foreign invoice id", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null)
    const result = await updateInvoiceDraft(USER_ID, updateArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Invoice not found" })
  })
})

describe("splitInvoice", () => {
  it("allocates every number inside the transaction via nextAutoNumber(tx, …)", async () => {
    nextAutoNumber
      .mockResolvedValueOnce("2026-0001")
      .mockResolvedValueOnce("2026-0002")
      .mockResolvedValueOnce("2026-0003")
    txMock.invoice.create
      .mockResolvedValueOnce({ id: "inv-a", number: "2026-0001" })
      .mockResolvedValueOnce({ id: "inv-b", number: "2026-0002" })
      .mockResolvedValueOnce({ id: "inv-c", number: "2026-0003" })

    await splitInvoice(USER_ID, splitArgs())

    expect(nextAutoNumber).toHaveBeenCalledTimes(3)
    for (const call of nextAutoNumber.mock.calls) {
      expect(call[0]).toBe(txMock)
      expect(call[1]).toBe(USER_ID)
    }
  })

  it("splits the total into cent-exact installments that sum back exactly", async () => {
    nextAutoNumber
      .mockResolvedValueOnce("2026-0001")
      .mockResolvedValueOnce("2026-0002")
      .mockResolvedValueOnce("2026-0003")
    txMock.invoice.create
      .mockResolvedValueOnce({ id: "inv-a", number: "2026-0001" })
      .mockResolvedValueOnce({ id: "inv-b", number: "2026-0002" })
      .mockResolvedValueOnce({ id: "inv-c", number: "2026-0003" })

    const result = await splitInvoice(
      USER_ID,
      splitArgs({
        lines: [{ label: "Contrat", qty: 1, rate: 100.01 }],
        parts: 3,
      }),
    )
    const { items } = result.structuredContent as {
      items: { total: number }[]
    }
    const sum = items.reduce((s, i) => s + i.total, 0)
    expect(Math.round(sum * 100)).toBe(10001)
    expect(items).toHaveLength(3)
  })

  it("attaches tasks to the first installment only", async () => {
    nextAutoNumber
      .mockResolvedValueOnce("2026-0001")
      .mockResolvedValueOnce("2026-0002")
      .mockResolvedValueOnce("2026-0003")
    txMock.invoice.create
      .mockResolvedValueOnce({ id: "inv-a", number: "2026-0001" })
      .mockResolvedValueOnce({ id: "inv-b", number: "2026-0002" })
      .mockResolvedValueOnce({ id: "inv-c", number: "2026-0003" })

    await splitInvoice(USER_ID, splitArgs({ taskIds: ["task-1"] }))

    expect(txMock.task.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["task-1"] },
        userId: USER_ID,
        clientId: "client-1",
      },
      data: { invoiceId: "inv-a", status: "DONE" },
    })
  })

  it("returns not-found for a client owned by another user", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await splitInvoice(USER_ID, splitArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Client not found" })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })
})

describe("recordPayment", () => {
  it("refuses a CANCELLED invoice as an isError result", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "CANCELLED",
      number: "2026-0001",
      clientId: "client-1",
    })
    const result = await recordPayment(USER_ID, paymentArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      text: "Cannot record a payment on a cancelled invoice",
    })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
  })

  it("calls recomputeInvoicePayment inside the same transaction", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "SENT",
      number: "2026-0001",
      clientId: "client-1",
    })
    await recordPayment(USER_ID, paymentArgs())
    expect(recomputeInvoicePayment).toHaveBeenCalledWith("inv-1", txMock)
  })

  it("returns the resulting balanceDue", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "SENT",
      number: "2026-0001",
      clientId: "client-1",
    })
    txMock.invoice.findUniqueOrThrow.mockResolvedValue({ total: 500 })
    txMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 200 } })
    const result = await recordPayment(USER_ID, paymentArgs({ amount: 200 }))
    expect(result.isError).toBeUndefined()
    const { balanceDue } = result.structuredContent as { balanceDue: number }
    expect(balanceDue).toBe(300)
  })

  it("never applies an amount cap", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: "inv-1",
      status: "SENT",
      number: "2026-0001",
      clientId: "client-1",
    })
    const result = await recordPayment(
      USER_ID,
      paymentArgs({ amount: 9_999_999 }),
    )
    expect(result.isError).toBeUndefined()
    expect(txMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 9_999_999 }),
      }),
    )
  })

  it("returns not-found for a foreign invoice id", async () => {
    prismaMock.invoice.findFirst.mockResolvedValue(null)
    const result = await recordPayment(USER_ID, paymentArgs())
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Invoice not found" })
  })
})
