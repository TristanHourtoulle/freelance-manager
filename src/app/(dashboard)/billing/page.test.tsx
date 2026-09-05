import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import BillingPage from "./page"
import type { InvoiceWireRow } from "@/domain/billing/types"

const { useInvoicesMock, useClientsMock } = vi.hoisted(() => ({
  useInvoicesMock: vi.fn(),
  useClientsMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: () => useInvoicesMock(),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => useClientsMock(),
}))

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: () => ({ data: undefined }),
}))

function buildInvoice(overrides: Partial<InvoiceWireRow> = {}): InvoiceWireRow {
  return {
    id: "inv-1",
    number: "F-2026-001",
    clientId: "client-1",
    projectId: null,
    status: "SENT",
    paymentStatus: "PARTIALLY_PAID",
    isOverdue: false,
    kind: "STANDARD",
    issueDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-31T00:00:00.000Z",
    paidAmount: 500,
    balanceDue: 1000,
    lastPaidAt: null,
    lateFeeAccrued: 0,
    lateFeeDue: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    penaltyPaid: 0,
    subtotal: 1500,
    tax: 0,
    total: 1500,
    totalOverride: null,
    notes: null,
    linesCount: 1,
    ...overrides,
  }
}

function buildClient() {
  return {
    id: "client-1",
    firstName: "Henri",
    lastName: "Mistral",
    company: "Mistral SAS",
    color: null,
  }
}

function invoicesQueryResult(data: InvoiceWireRow[]) {
  return {
    data,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }
}

describe("DesktopBillingPage penalty column", () => {
  it("shows the frozen claimed amount, not the live accrued amount, once lateFeeClaimedAt is set", () => {
    useInvoicesMock.mockReturnValue(
      invoicesQueryResult([
        buildInvoice({
          id: "inv-claimed",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeDue: 44.94,
          lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
          lateFeeWaived: false,
        }),
      ]),
    )
    useClientsMock.mockReturnValue({ data: [buildClient()] })

    render(<BillingPage />)

    expect(screen.getByText(/\+44,94 €\s*pénalité/)).toBeInTheDocument()
    expect(screen.queryByText(/\+58,69 €\s*pénalité/)).not.toBeInTheDocument()
  })

  it("shows the live accrued amount when nothing has been claimed yet", () => {
    useInvoicesMock.mockReturnValue(
      invoicesQueryResult([
        buildInvoice({
          id: "inv-unclaimed",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeDue: 0,
          lateFeeClaimedAt: null,
          lateFeeWaived: false,
        }),
      ]),
    )
    useClientsMock.mockReturnValue({ data: [buildClient()] })

    render(<BillingPage />)

    expect(screen.getByText(/\+58,69 €\s*pénalité/)).toBeInTheDocument()
  })

  it("hides the penalty amount once it was waived", () => {
    useInvoicesMock.mockReturnValue(
      invoicesQueryResult([
        buildInvoice({
          id: "inv-waived",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeDue: 0,
          lateFeeClaimedAt: null,
          lateFeeWaived: true,
        }),
      ]),
    )
    useClientsMock.mockReturnValue({ data: [buildClient()] })

    render(<BillingPage />)

    expect(screen.queryByText(/pénalité/)).not.toBeInTheDocument()
  })
})
