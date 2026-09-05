import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LateFeePanel } from "./late-fee-panel"
import type { InvoiceLateFeeBreakdown } from "@/domain/billing/types"

const { claimMutate, waiveMutate, toast } = vi.hoisted(() => ({
  claimMutate: vi.fn(),
  waiveMutate: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useClaimLateFee: () => ({ mutate: claimMutate, isPending: false }),
  useWaiveLateFee: () => ({ mutate: waiveMutate, isPending: false }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast }),
}))

const UNCLAIMED_BREAKDOWN: InvoiceLateFeeBreakdown = {
  daysLate: 21,
  fixed: 40,
  interest: 18.69,
  total: 58.69,
  segments: [
    {
      from: "2026-08-14T00:00:00.000Z",
      to: "2026-08-21T00:00:00.000Z",
      days: 7,
      outstanding: 4460,
      interest: 8.55,
    },
    {
      from: "2026-08-21T00:00:00.000Z",
      to: "2026-09-04T00:00:00.000Z",
      days: 14,
      outstanding: 1500,
      interest: 10.14,
    },
  ],
}

const CLAIMED_BREAKDOWN: InvoiceLateFeeBreakdown = {
  ...UNCLAIMED_BREAKDOWN,
  fixed: 40,
  interest: 4.94,
  total: 44.94,
}

const BASE_PROPS = {
  invoiceId: "inv-1",
  dueDate: "2026-07-01",
  lateFeeAccrued: 0,
  lateFeeDue: 0,
  lateFeeClaimedAt: null as string | null,
  lateFeeWaived: false,
  lateFeeBreakdown: null as InvoiceLateFeeBreakdown | null,
}

describe("LateFeePanel", () => {
  it("renders nothing when nothing has accrued", () => {
    const { container } = render(<LateFeePanel {...BASE_PROPS} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the live accrued amount as unclaimed", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={0}
        lateFeeBreakdown={UNCLAIMED_BREAKDOWN}
      />,
    )

    expect(screen.getByText("Pénalité de retard")).toBeInTheDocument()
    expect(screen.getByText("58,69 €")).toBeInTheDocument()
    expect(screen.getByText("non réclamée")).toBeInTheDocument()
    expect(screen.getByText("Réclamer")).toBeInTheDocument()
    expect(screen.queryByText("Renoncer")).not.toBeInTheDocument()
  })

  it("shows the frozen amount once claimed, with a Renoncer action", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={44.94}
        lateFeeClaimedAt="2026-08-15T10:00:00.000Z"
        lateFeeBreakdown={CLAIMED_BREAKDOWN}
      />,
    )

    expect(screen.getByText("44,94 €")).toBeInTheDocument()
    expect(screen.queryByText("non réclamée")).not.toBeInTheDocument()
    expect(screen.getByText("Renoncer")).toBeInTheDocument()
    expect(screen.queryByText("Réclamer")).not.toBeInTheDocument()
  })

  it("says the penalty was waived instead of hiding it, and still allows reclaiming", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={0}
        lateFeeWaived={true}
        lateFeeBreakdown={UNCLAIMED_BREAKDOWN}
      />,
    )

    expect(screen.getByText("Renoncée")).toBeInTheDocument()
    expect(screen.getByText("Réclamer")).toBeInTheDocument()
    expect(screen.queryByText("Renoncer")).not.toBeInTheDocument()
  })

  it("shows the real forfait/intérêts breakdown and per-period detail for an already-claimed penalty", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={44.94}
        lateFeeClaimedAt="2026-08-15T10:00:00.000Z"
        lateFeeBreakdown={CLAIMED_BREAKDOWN}
      />,
    )

    fireEvent.click(screen.getByText("Pénalité de retard"))

    expect(
      screen.queryByText(
        "Détail forfait / intérêts figé non disponible pour une pénalité déjà réclamée.",
      ),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Indemnité forfaitaire")).toBeInTheDocument()
    expect(screen.getByText("40 €")).toBeInTheDocument()
    expect(screen.getByText("Intérêts de retard")).toBeInTheDocument()
    expect(screen.getByText("4,94 €")).toBeInTheDocument()
    expect(screen.getByText("21 j")).toBeInTheDocument()
    expect(screen.getByText("Détail par période")).toBeInTheDocument()
    expect(screen.getByText(/8,55 €/)).toBeInTheDocument()
    expect(screen.getByText(/10,14 €/)).toBeInTheDocument()
  })

  it("expands the flat/interest breakdown and per-period detail for an unclaimed penalty", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={0}
        lateFeeBreakdown={UNCLAIMED_BREAKDOWN}
      />,
    )

    fireEvent.click(screen.getByText("Pénalité de retard"))

    expect(screen.getByText("Indemnité forfaitaire")).toBeInTheDocument()
    expect(screen.getByText("40 €")).toBeInTheDocument()
    expect(screen.getByText("Intérêts de retard")).toBeInTheDocument()
    expect(screen.getByText("18,69 €")).toBeInTheDocument()
    expect(screen.getByText("Détail par période")).toBeInTheDocument()
  })

  it("claims the full accrued amount by default, split into fixed/interest", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={0}
        lateFeeBreakdown={UNCLAIMED_BREAKDOWN}
      />,
    )

    fireEvent.click(screen.getByText("Réclamer"))
    const confirmButtons = screen.getAllByRole("button", { name: "Réclamer" })
    fireEvent.click(confirmButtons[confirmButtons.length - 1] as HTMLElement)

    expect(claimMutate).toHaveBeenCalledWith(
      { fixed: 40, interest: 18.69 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it("claims a reduced amount, keeping the flat fee whole and reducing interest first", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={0}
        lateFeeBreakdown={UNCLAIMED_BREAKDOWN}
      />,
    )

    fireEvent.click(screen.getByText("Réclamer"))
    const input = screen.getByLabelText("Montant à réclamer")
    fireEvent.change(input, { target: { value: "44.94" } })
    const confirmButtons = screen.getAllByRole("button", { name: "Réclamer" })
    fireEvent.click(confirmButtons[confirmButtons.length - 1] as HTMLElement)

    expect(claimMutate).toHaveBeenCalledWith(
      { fixed: 40, interest: 4.94 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })

  it("waives a claimed penalty after confirmation", () => {
    render(
      <LateFeePanel
        {...BASE_PROPS}
        lateFeeAccrued={58.69}
        lateFeeDue={44.94}
        lateFeeClaimedAt="2026-08-15T10:00:00.000Z"
        lateFeeBreakdown={CLAIMED_BREAKDOWN}
      />,
    )

    fireEvent.click(screen.getByText("Renoncer"))
    const confirmButtons = screen.getAllByRole("button", { name: "Renoncer" })
    fireEvent.click(confirmButtons[confirmButtons.length - 1] as HTMLElement)

    expect(waiveMutate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    )
  })
})
