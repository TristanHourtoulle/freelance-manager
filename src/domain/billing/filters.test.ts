import { describe, expect, it } from "vitest"
import {
  matchesInvoiceFilter,
  summarizeInvoices,
  type InvoiceFilterId,
} from "./filters"

type Row = Parameters<typeof summarizeInvoices>[0][number]

function row(overrides: Partial<Row>): Row {
  return {
    status: "SENT",
    paymentStatus: "UNPAID",
    isOverdue: false,
    paidAmount: 0,
    balanceDue: 0,
    ...overrides,
  }
}

describe("matchesInvoiceFilter", () => {
  const cases: {
    label: string
    invoice: Parameters<typeof matchesInvoiceFilter>[0]
    filter: InvoiceFilterId
    expected: boolean
  }[] = [
    {
      label: "all matches everything",
      invoice: { status: "DRAFT", paymentStatus: "UNPAID", isOverdue: false },
      filter: "all",
      expected: true,
    },
    {
      label: "DRAFT matches draft docs",
      invoice: { status: "DRAFT", paymentStatus: "UNPAID", isOverdue: false },
      filter: "DRAFT",
      expected: true,
    },
    {
      label: "SENT excludes overdue sent",
      invoice: { status: "SENT", paymentStatus: "UNPAID", isOverdue: true },
      filter: "SENT",
      expected: false,
    },
    {
      label: "SENT matches issued, unpaid, on-time",
      invoice: { status: "SENT", paymentStatus: "UNPAID", isOverdue: false },
      filter: "SENT",
      expected: true,
    },
    {
      label: "PARTIAL matches partially paid",
      invoice: {
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        isOverdue: false,
      },
      filter: "PARTIAL",
      expected: true,
    },
    {
      label: "PAID matches fully paid",
      invoice: { status: "SENT", paymentStatus: "PAID", isOverdue: false },
      filter: "PAID",
      expected: true,
    },
    {
      label: "PAID does not match overpaid",
      invoice: { status: "SENT", paymentStatus: "OVERPAID", isOverdue: false },
      filter: "PAID",
      expected: false,
    },
    {
      label: "OVERPAID matches overpaid",
      invoice: { status: "SENT", paymentStatus: "OVERPAID", isOverdue: false },
      filter: "OVERPAID",
      expected: true,
    },
    {
      label: "OVERDUE matches overdue flag",
      invoice: { status: "SENT", paymentStatus: "UNPAID", isOverdue: true },
      filter: "OVERDUE",
      expected: true,
    },
  ]

  for (const c of cases) {
    it(c.label, () => {
      expect(matchesInvoiceFilter(c.invoice, c.filter)).toBe(c.expected)
    })
  }
})

describe("summarizeInvoices", () => {
  it("counts each bucket and sums paid / outstanding / overdue money", () => {
    const invoices: Row[] = [
      row({ status: "DRAFT" }),
      row({ status: "SENT", paymentStatus: "UNPAID" }),
      row({
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        balanceDue: 300,
        paidAmount: 200,
      }),
      row({ status: "SENT", paymentStatus: "PAID", paidAmount: 500 }),
      row({ status: "SENT", paymentStatus: "OVERPAID", paidAmount: 700 }),
      row({
        status: "SENT",
        paymentStatus: "UNPAID",
        isOverdue: true,
        balanceDue: 400,
      }),
    ]

    const { counts, totals } = summarizeInvoices(invoices)

    expect(counts).toEqual({
      all: 6,
      draft: 1,
      sent: 1,
      partial: 1,
      paid: 1,
      overpaid: 1,
      overdue: 1,
    })
    expect(totals).toEqual({
      paid: 1200,
      outstanding: 700,
      overdue: 400,
    })
  })

  it("returns zeroed counts and totals for an empty list", () => {
    const { counts, totals } = summarizeInvoices([])
    expect(counts).toEqual({
      all: 0,
      draft: 0,
      sent: 0,
      partial: 0,
      paid: 0,
      overpaid: 0,
      overdue: 0,
    })
    expect(totals).toEqual({ paid: 0, outstanding: 0, overdue: 0 })
  })
})
