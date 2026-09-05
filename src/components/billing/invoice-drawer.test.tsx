import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { InvoiceDrawer } from "./invoice-drawer"
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
  useUpdatePayment: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePayment: () => ({ mutate: vi.fn(), isPending: false }),
  useClaimLateFee: () => ({ mutate: vi.fn(), isPending: false }),
  useWaiveLateFee: () => ({ mutate: vi.fn(), isPending: false }),
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
    paymentStatus: "PARTIALLY_PAID",
    isOverdue: true,
    kind: "STANDARD",
    issueDate: "2026-07-01",
    dueDate: "2026-07-31",
    paidAmount: 500,
    balanceDue: 1000,
    lastPaidAt: "2026-08-01",
    lateFeeAccrued: 0,
    lateFeeDue: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    lateFeeBreakdown: null,
    penaltyPaid: 0,
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

describe("InvoiceDrawer totals block", () => {
  it("shows nothing when no penalty has accrued", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({}),
      isLoading: false,
    })

    render(<InvoiceDrawer invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.queryByText("Pénalité de retard")).not.toBeInTheDocument()
  })

  it("shows the accrued, unclaimed penalty in the totals block", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({ lateFeeAccrued: 58.69, lateFeeDue: 0 }),
      isLoading: false,
    })

    render(<InvoiceDrawer invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("Pénalité de retard")).toBeInTheDocument()
    expect(screen.getByText("58,69 €")).toBeInTheDocument()
    expect(screen.getByText("non réclamée")).toBeInTheDocument()
  })

  it("shows the frozen, claimed penalty amount", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        lateFeeAccrued: 58.69,
        lateFeeDue: 44.94,
        lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
      }),
      isLoading: false,
    })

    render(<InvoiceDrawer invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("44,94 €")).toBeInTheDocument()
    expect(screen.getByText("Renoncer")).toBeInTheDocument()
  })

  it("says the penalty was waived rather than hiding it", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        lateFeeAccrued: 58.69,
        lateFeeDue: 0,
        lateFeeWaived: true,
      }),
      isLoading: false,
    })

    render(<InvoiceDrawer invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("Renoncée")).toBeInTheDocument()
  })
})
