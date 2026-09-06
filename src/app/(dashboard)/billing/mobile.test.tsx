import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MobileBillingPage, MobileInvoiceSheet } from "./mobile"
import type { InvoiceDetail } from "@/domain/billing/types"

const {
  useInvoiceMock,
  useInvoicesMock,
  useClientsMock,
  createPaymentMutateMock,
  useSearchParamsMock,
  replaceMock,
} = vi.hoisted(() => ({
  useInvoiceMock: vi.fn(),
  useInvoicesMock: vi.fn(),
  useClientsMock: vi.fn(),
  createPaymentMutateMock: vi.fn(),
  useSearchParamsMock: vi.fn<() => URLSearchParams>(
    () => new URLSearchParams(),
  ),
  replaceMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  usePathname: () => "/billing",
  useSearchParams: () => useSearchParamsMock(),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoice: (id: string) => useInvoiceMock(id),
  useInvoices: () => useInvoicesMock(),
  useUpdateInvoiceStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useCreatePayment: () => ({
    mutate: createPaymentMutateMock,
    isPending: false,
  }),
  useClaimLateFee: () => ({ mutate: vi.fn(), isPending: false }),
  useWaiveLateFee: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => useClientsMock(),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

beforeEach(() => {
  createPaymentMutateMock.mockReset()
  useSearchParamsMock.mockReturnValue(new URLSearchParams())
  replaceMock.mockReset()
})

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

  it("shows the accrued penalty as unclaimed (warn) in the totals block", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        isOverdue: true,
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 500,
        balanceDue: 1000,
        lateFeeAccrued: 58.69,
        lateFeeDue: 0,
        lateFeeClaimedAt: null,
        lateFeeWaived: false,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("Pénalité de retard")).toBeInTheDocument()
    expect(screen.getByText("58,69 €")).toBeInTheDocument()
    expect(screen.getByText("non réclamée")).toBeInTheDocument()
    expect(screen.getByText("Réclamer")).toBeInTheDocument()
    expect(screen.queryByText("Renoncer")).not.toBeInTheDocument()
  })

  it("shows the frozen penalty as claimed (danger) once lateFeeClaimedAt is set", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        isOverdue: true,
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 500,
        balanceDue: 1044.94,
        lateFeeAccrued: 58.69,
        lateFeeDue: 44.94,
        lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
        lateFeeWaived: false,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("44,94 €")).toBeInTheDocument()
    expect(screen.queryByText("non réclamée")).not.toBeInTheDocument()
    expect(screen.getByText("Renoncer")).toBeInTheDocument()
    expect(screen.queryByText("Réclamer")).not.toBeInTheDocument()
  })

  it("says the penalty was waived rather than hiding it", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        isOverdue: true,
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 500,
        balanceDue: 1000,
        lateFeeAccrued: 58.69,
        lateFeeDue: 0,
        lateFeeClaimedAt: null,
        lateFeeWaived: true,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)

    expect(screen.getByText("Renoncée")).toBeInTheDocument()
    expect(screen.getByText("Réclamer")).toBeInTheDocument()
  })
})

describe("MobileBillingPage", () => {
  it("suffixes the overdue line with the unclaimed penalty amount", () => {
    useInvoicesMock.mockReturnValue({
      data: [
        buildInvoice({
          id: "inv-overdue",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeWaived: false,
        }),
      ],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({
      data: [
        {
          id: "client-1",
          firstName: "Henri",
          lastName: "Mistral",
          company: "Mistral SAS",
          color: null,
        },
      ],
    })

    render(<MobileBillingPage />)

    const penaltyLine = screen.getByText(/58,69 €\s*pénalité/)
    expect(penaltyLine).toBeInTheDocument()
  })

  it("shows the frozen claimed amount, not the live accrued amount, once lateFeeClaimedAt is set", () => {
    useInvoicesMock.mockReturnValue({
      data: [
        buildInvoice({
          id: "inv-claimed",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeDue: 44.94,
          lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
          lateFeeWaived: false,
        }),
      ],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({
      data: [
        {
          id: "client-1",
          firstName: "Henri",
          lastName: "Mistral",
          company: "Mistral SAS",
          color: null,
        },
      ],
    })

    render(<MobileBillingPage />)

    expect(screen.getByText(/44,94 €\s*pénalité/)).toBeInTheDocument()
    expect(screen.queryByText(/58,69 €\s*pénalité/)).not.toBeInTheDocument()
  })

  it("hides the penalty suffix once the penalty was waived", () => {
    useInvoicesMock.mockReturnValue({
      data: [
        buildInvoice({
          id: "inv-overdue",
          isOverdue: true,
          lateFeeAccrued: 58.69,
          lateFeeWaived: true,
        }),
      ],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({
      data: [
        {
          id: "client-1",
          firstName: "Henri",
          lastName: "Mistral",
          company: "Mistral SAS",
          color: null,
        },
      ],
    })

    render(<MobileBillingPage />)

    expect(screen.queryByText(/pénalité/)).not.toBeInTheDocument()
  })
})

describe("MobileBillingPage openId search param", () => {
  it("opens the sheet for a changed ?invoiceId= without remounting the page", () => {
    useInvoicesMock.mockReturnValue({
      data: [buildInvoice({ id: "inv-1" }), buildInvoice({ id: "inv-2" })],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({ data: [] })
    useInvoiceMock.mockReturnValue({ data: undefined })

    const { rerender } = render(<MobileBillingPage />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    useSearchParamsMock.mockReturnValue(new URLSearchParams("invoiceId=inv-2"))
    rerender(<MobileBillingPage />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("does not clobber a row-tap open with a stale unchanged search param", () => {
    useInvoicesMock.mockReturnValue({
      data: [buildInvoice({ id: "inv-1" })],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({ data: [] })
    useInvoiceMock.mockReturnValue({ data: buildInvoice({ id: "inv-1" }) })

    const { rerender } = render(<MobileBillingPage />)
    fireEvent.click(screen.getByText(/F-2026-001/).closest("button")!)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    rerender(<MobileBillingPage />)

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("strips ?invoiceId= from the URL when the sheet is closed", () => {
    useInvoicesMock.mockReturnValue({
      data: [buildInvoice({ id: "inv-1" })],
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    })
    useClientsMock.mockReturnValue({ data: [] })
    useInvoiceMock.mockReturnValue({ data: buildInvoice({ id: "inv-1" }) })
    useSearchParamsMock.mockReturnValue(new URLSearchParams("invoiceId=inv-1"))

    render(<MobileBillingPage />)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Fermer"))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(replaceMock).toHaveBeenCalledWith("/billing", { scroll: false })
  })
})

describe("MobileInvoiceSheet — markPaid penalty attribution", () => {
  it("attributes the full outstanding claimed penalty when the payment settles the whole balance", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 4000,
        balanceDue: 1044.94,
        lateFeeAccrued: 44.94,
        lateFeeDue: 44.94,
        lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
        lateFeeWaived: false,
        penaltyPaid: 0,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Marquer payée"))

    expect(createPaymentMutateMock).toHaveBeenCalledTimes(1)
    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.amount).toBe(1044.94)
    expect(input.penaltyAmount).toBe(44.94)
  })

  it("caps the attributed penalty at the payment amount, respecting the penaltyAmount <= amount invariant", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 0,
        balanceDue: 30,
        lateFeeDue: 44.94,
        lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
        lateFeeWaived: false,
        penaltyPaid: 0,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Marquer payée"))

    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.amount).toBe(30)
    expect(input.penaltyAmount).toBe(30)
    expect(input.penaltyAmount).toBeLessThanOrEqual(input.amount)
  })

  it("only attributes what remains unpaid of the claimed penalty", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 20,
        balanceDue: 1024.94,
        lateFeeDue: 44.94,
        lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
        lateFeeWaived: false,
        penaltyPaid: 20,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Marquer payée"))

    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.penaltyAmount).toBe(24.94)
  })

  it("attributes no penalty when nothing has been claimed", () => {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        status: "SENT",
        paymentStatus: "UNPAID",
        balanceDue: 1500,
        lateFeeDue: 0,
        lateFeeClaimedAt: null,
        penaltyPaid: 0,
      }),
    })

    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Marquer payée"))

    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.penaltyAmount).toBe(0)
  })
})

describe("MobilePartialPaymentSheet penalty attribution", () => {
  function openPartialSheet(overrides: Partial<InvoiceDetail>) {
    useInvoiceMock.mockReturnValue({
      data: buildInvoice({
        status: "SENT",
        paymentStatus: "PARTIALLY_PAID",
        paidAmount: 500,
        balanceDue: 1044.94,
        ...overrides,
      }),
    })
    render(<MobileInvoiceSheet invoiceId="inv-1" onClose={vi.fn()} />)
    fireEvent.click(screen.getByText("Paiement partiel"))
  }

  it("defaults penaltyAmount to the outstanding claimed penalty when the payment covers it", () => {
    openPartialSheet({
      lateFeeDue: 44.94,
      lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
      penaltyPaid: 0,
    })

    fireEvent.change(screen.getByLabelText("Montant"), {
      target: { value: "100" },
    })
    fireEvent.click(screen.getByText("Enregistrer"))

    expect(createPaymentMutateMock).toHaveBeenCalledTimes(1)
    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.amount).toBe(100)
    expect(input.penaltyAmount).toBe(44.94)
  })

  it("clamps penaltyAmount to the payment amount when it does not fully cover the outstanding penalty", () => {
    openPartialSheet({
      lateFeeDue: 44.94,
      lateFeeClaimedAt: "2026-08-15T10:00:00.000Z",
      penaltyPaid: 0,
    })

    fireEvent.change(screen.getByLabelText("Montant"), {
      target: { value: "20" },
    })
    fireEvent.click(screen.getByText("Enregistrer"))

    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.amount).toBe(20)
    expect(input.penaltyAmount).toBe(20)
    expect(input.penaltyAmount).toBeLessThanOrEqual(input.amount)
  })

  it("defaults penaltyAmount to 0 when there is no outstanding claimed penalty", () => {
    openPartialSheet({
      lateFeeDue: 0,
      lateFeeClaimedAt: null,
      penaltyPaid: 0,
    })

    fireEvent.change(screen.getByLabelText("Montant"), {
      target: { value: "100" },
    })
    fireEvent.click(screen.getByText("Enregistrer"))

    const [input] = createPaymentMutateMock.mock.calls[0] as [
      { amount: number; penaltyAmount: number },
    ]
    expect(input.penaltyAmount).toBe(0)
  })
})
