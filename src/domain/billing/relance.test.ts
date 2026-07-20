import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildRelanceRows,
  relanceTitle,
  type RelanceInvoiceRow,
} from "./relance"

const NOW = new Date(2026, 2, 15, 12, 0, 0)
const PAST_DUE = new Date(2026, 1, 1)
const FUTURE_DUE = new Date(2026, 3, 1)

function invoice(
  overrides: Partial<RelanceInvoiceRow> = {},
): RelanceInvoiceRow {
  return {
    id: "inv-1",
    number: "F-2026-001",
    clientId: "client-1",
    status: "SENT",
    paymentStatus: "UNPAID",
    total: 1000,
    dueDate: PAST_DUE,
    payments: [],
    ...overrides,
  }
}

describe("buildRelanceRows", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates exactly one row for a past-due invoice with a positive balance", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [invoice()],
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      userId: "user-1",
      clientId: "client-1",
      type: "RELANCE",
      title: relanceTitle("F-2026-001"),
      dueDate: NOW,
      invoiceId: "inv-1",
      relanceInvoiceId: "inv-1",
    })
  })

  it("creates no row when a past-due invoice is fully settled", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [
        invoice({
          paymentStatus: "UNPAID",
          payments: [{ amount: 1000, paidAt: new Date(2026, 1, 20) }],
        }),
      ],
    })

    expect(rows).toEqual([])
  })

  it("creates no row when the balance is negative (overpaid)", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [
        invoice({
          paymentStatus: "UNPAID",
          payments: [{ amount: 1500, paidAt: new Date(2026, 1, 20) }],
        }),
        invoice({
          id: "inv-2",
          number: "F-2026-002",
          paymentStatus: "OVERPAID",
          payments: [{ amount: 1200, paidAt: new Date(2026, 1, 20) }],
        }),
      ],
    })

    expect(rows).toEqual([])
  })

  it("creates no row when the invoice already has an auto-relance", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [invoice()],
      existingRelanceInvoiceIds: ["inv-1"],
    })

    expect(rows).toEqual([])
  })

  it("ignores invoices that are not yet past due", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [invoice({ dueDate: FUTURE_DUE })],
    })

    expect(rows).toEqual([])
  })

  it("ignores draft and cancelled invoices", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [
        invoice({ id: "inv-draft", status: "DRAFT" }),
        invoice({ id: "inv-cancelled", status: "CANCELLED" }),
      ],
    })

    expect(rows).toEqual([])
  })

  it("emits at most one row per invoice id even when duplicated in the batch", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [invoice(), invoice()],
    })

    expect(rows).toHaveLength(1)
  })

  it("keeps eligible invoices while skipping settled ones in the same batch", () => {
    const rows = buildRelanceRows({
      userId: "user-1",
      now: NOW,
      invoices: [
        invoice(),
        invoice({
          id: "inv-2",
          number: "F-2026-002",
          clientId: "client-2",
          payments: [{ amount: 1000, paidAt: new Date(2026, 1, 20) }],
        }),
        invoice({ id: "inv-3", number: "F-2026-003", clientId: "client-3" }),
      ],
    })

    expect(rows.map((r) => r.relanceInvoiceId)).toEqual(["inv-1", "inv-3"])
  })
})
