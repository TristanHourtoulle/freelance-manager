import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileInvoiceSheet } from "./mobile"
import type { InvoiceDetail } from "@/domain/billing/types"

const { useInvoiceMock } = vi.hoisted(() => ({
  useInvoiceMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoice: (id: string) => useInvoiceMock(id),
  useUpdateInvoiceStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useCreatePayment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

function buildInvoice(overrides: Partial<InvoiceDetail>): InvoiceDetail {
  return {
    id: "inv-1",
    number: "F-2026-001",
    clientId: "client-1",
    projectId: null,
    status: "SENT",
    paymentStatus: "UNPAID",
    isOverdue: false,
    kind: "STANDARD",
    issueDate: "2026-07-01",
    dueDate: "2026-07-31",
    paidAmount: 0,
    balanceDue: 1500,
    lastPaidAt: null,
    subtotal: 1500,
    tax: 0,
    total: 1500,
    totalOverride: null,
    notes: null,
    linesCount: 1,
    client: {
      id: "client-1",
      firstName: "Henri",
      lastName: "Mistral",
      company: "Mistral SAS",
      email: "henri@mistral.fr",
      billingMode: "FIXED",
      color: null,
    },
    lines: [
      {
        id: "line-1",
        taskId: null,
        label: "[TRI-1] Refonte site",
        qty: 5,
        rate: 900,
      },
    ],
    payments: [],
    ...overrides,
  }
}

describe("MobileInvoiceSheet", () => {
  it("hides per-line pricing and shows the forfait note for override invoices", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        kind: "DEPOSIT",
        totalOverride: 1500,
        total: 1500,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("forfait — prix non détaillés")).toBeInTheDocument()
    expect(screen.getByText("[TRI-1] Refonte site")).toBeInTheDocument()
    expect(screen.queryByText("5 × 900 €")).not.toBeInTheDocument()
    expect(screen.queryByText("4 500 €")).not.toBeInTheDocument()
    expect(screen.getAllByText("1 500 €").length).toBeGreaterThan(0)
  })

  it("renders per-line pricing for standard invoices", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({}),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)

    expect(
      screen.queryByText("forfait — prix non détaillés"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("5 × 900 €")).toBeInTheDocument()
    expect(screen.getByText("4 500 €")).toBeInTheDocument()
  })
})
