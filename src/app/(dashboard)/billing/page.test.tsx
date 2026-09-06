import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import BillingPage from "./page"
import type { InvoiceWireRow } from "@/domain/billing/types"

const { useInvoicesMock, useClientsMock, useSearchParamsMock } = vi.hoisted(
  () => ({
    useInvoicesMock: vi.fn(),
    useClientsMock: vi.fn(),
    useSearchParamsMock: vi.fn<() => URLSearchParams>(
      () => new URLSearchParams(),
    ),
  }),
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => useSearchParamsMock(),
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

vi.mock("@/components/billing/invoice-drawer", () => ({
  InvoiceDrawer: ({ invoiceId }: { invoiceId: string }) => (
    <div data-testid="invoice-drawer">{invoiceId}</div>
  ),
}))

beforeEach(() => {
  useSearchParamsMock.mockReturnValue(new URLSearchParams())
})

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

describe("DesktopBillingPage openId search param", () => {
  it("opens the drawer for a changed ?invoiceId= without remounting the page", () => {
    useInvoicesMock.mockReturnValue(
      invoicesQueryResult([
        buildInvoice({ id: "inv-1" }),
        buildInvoice({ id: "inv-2" }),
      ]),
    )
    useClientsMock.mockReturnValue({ data: [buildClient()] })

    const { rerender } = render(<BillingPage />)
    expect(screen.queryByTestId("invoice-drawer")).not.toBeInTheDocument()

    useSearchParamsMock.mockReturnValue(new URLSearchParams("invoiceId=inv-2"))
    rerender(<BillingPage />)

    expect(screen.getByTestId("invoice-drawer")).toHaveTextContent("inv-2")
  })

  it("does not clobber a row-click open with a stale unchanged search param", () => {
    useInvoicesMock.mockReturnValue(
      invoicesQueryResult([buildInvoice({ id: "inv-1" })]),
    )
    useClientsMock.mockReturnValue({ data: [buildClient()] })

    const { rerender } = render(<BillingPage />)
    fireEvent.click(screen.getByText("F-2026-001").closest("tr")!)
    expect(screen.getByTestId("invoice-drawer")).toHaveTextContent("inv-1")

    rerender(<BillingPage />)

    expect(screen.getByTestId("invoice-drawer")).toHaveTextContent("inv-1")
  })
})
