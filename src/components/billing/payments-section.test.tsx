import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { PaymentsSection } from "./payments-section"
import { fmtEURprecise } from "@/lib/format"
import type { InvoicePaymentDTO } from "@/domain/billing/types"

const { createMutate, updateMutate, toastMock } = vi.hoisted(() => ({
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useCreatePayment: () => ({ mutate: createMutate, isPending: false }),
  useUpdatePayment: () => ({ mutate: updateMutate, isPending: false }),
  useDeletePayment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: toastMock }),
}))

function payment(overrides: Partial<InvoicePaymentDTO>): InvoicePaymentDTO {
  return {
    id: "pay-1",
    amount: 500,
    paidAt: "2026-08-01T00:00:00.000Z",
    method: null,
    note: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    penaltyAmount: 0,
    ...overrides,
  }
}

describe("PaymentsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the penalty share of a partially-paid balance", () => {
    const { container } = render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={1044.94}
        paidAmount={200}
        payments={[payment({ amount: 200 })]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={0}
      />,
    )

    expect(container.textContent).toContain(
      `dont ${fmtEURprecise(44.94)} de pénalité`,
    )
  })

  it("does not mention a penalty when nothing was claimed", () => {
    const { container } = render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={1000}
        paidAmount={0}
        payments={[]}
        documentStatus="SENT"
      />,
    )

    expect(container.textContent).not.toContain("pénalité")
  })

  it("shows the penalty portion on a payment row", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={0}
        paidAmount={1044.94}
        payments={[payment({ amount: 1044.94, penaltyAmount: 44.94 })]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={44.94}
      />,
    )

    expect(screen.getByText("dont 44,94 € de pénalité")).toBeInTheDocument()
  })

  it("offers the optional penalty field only while adding, and caps it at the outstanding penalty", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={1044.94}
        paidAmount={0}
        payments={[]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={0}
      />,
    )

    fireEvent.click(screen.getByText("Enregistrer un paiement"))

    const field = screen.getByLabelText("Dont pénalité de retard (optionnel)")
    expect(field).toHaveAttribute("max", "44.94")
  })

  it("hides the penalty field once the outstanding penalty is settled", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={1000}
        paidAmount={44.94}
        payments={[payment({ amount: 44.94, penaltyAmount: 44.94 })]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={44.94}
      />,
    )

    fireEvent.click(screen.getByText("Enregistrer un paiement"))

    expect(
      screen.queryByLabelText("Dont pénalité de retard (optionnel)"),
    ).not.toBeInTheDocument()
  })

  it("submits the entered penalty amount alongside the payment", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={1044.94}
        paidAmount={0}
        payments={[]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={0}
      />,
    )

    fireEvent.click(screen.getByText("Enregistrer un paiement"))
    fireEvent.change(screen.getByLabelText("Montant (€)"), {
      target: { value: "1044.94" },
    })
    fireEvent.change(
      screen.getByLabelText("Dont pénalité de retard (optionnel)"),
      { target: { value: "44.94" } },
    )
    fireEvent.click(screen.getByText("Enregistrer"))

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1044.94, penaltyAmount: 44.94 }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it("blocks lowering a payment's amount below its own frozen penalty when editing", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={0}
        paidAmount={1044.94}
        payments={[payment({ amount: 1044.94, penaltyAmount: 44.94 })]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={44.94}
      />,
    )

    fireEvent.click(screen.getByTitle("Modifier"))
    fireEvent.change(screen.getByLabelText("Montant (€)"), {
      target: { value: "30" },
    })

    expect(
      screen.getByText(/couvre 44,94 €.*pénalité/),
    ).toBeInTheDocument()
    expect(screen.getByText("Mettre à jour")).toBeDisabled()

    fireEvent.click(screen.getByText("Mettre à jour"))

    expect(updateMutate).not.toHaveBeenCalled()
  })

  it("allows editing a payment's amount when it still covers the frozen penalty", () => {
    render(
      <PaymentsSection
        invoiceId="inv-1"
        total={1000}
        balanceDue={0}
        paidAmount={1044.94}
        payments={[payment({ amount: 1044.94, penaltyAmount: 44.94 })]}
        documentStatus="SENT"
        lateFeeDue={44.94}
        penaltyPaid={44.94}
      />,
    )

    fireEvent.click(screen.getByTitle("Modifier"))
    fireEvent.change(screen.getByLabelText("Montant (€)"), {
      target: { value: "50" },
    })
    fireEvent.click(screen.getByText("Mettre à jour"))

    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay-1", amount: 50 }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })
})
