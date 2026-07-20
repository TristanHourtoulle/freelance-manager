import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { BillingDefaultsCard } from "./billing-defaults-card"

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({
    data: {
      defaultCurrency: "EUR",
      defaultPaymentDays: 45,
      defaultRate: 620,
      hasLinearToken: false,
      linearTokenPreview: null,
      linearLastSyncedAt: null,
    },
    isPending: false,
  }),
  useUpdateSettings: () => ({ mutate, isPending: false }),
}))

describe("BillingDefaultsCard", () => {
  it("hydrates the fields from the persisted settings", async () => {
    render(<BillingDefaultsCard />)

    await waitFor(() =>
      expect(screen.getByLabelText("Délai de paiement (jours)")).toHaveValue(
        45,
      ),
    )
    expect(screen.getByLabelText("Taux par défaut (€)")).toHaveValue(620)
  })

  it("renders the currency as a disabled EUR field", () => {
    render(<BillingDefaultsCard />)

    const currency = screen.getByLabelText("Devise")
    expect(currency).toHaveValue("EUR")
    expect(currency).toBeDisabled()
  })

  it("keeps the save button disabled until a value actually changes", async () => {
    render(<BillingDefaultsCard />)

    const save = screen.getByRole("button", { name: /Enregistrer/ })
    await waitFor(() => expect(save).toBeDisabled())

    fireEvent.change(screen.getByLabelText("Délai de paiement (jours)"), {
      target: { value: "60" },
    })

    expect(save).toBeEnabled()
  })

  it("never sends the currency in the update payload", async () => {
    mutate.mockClear()
    render(<BillingDefaultsCard />)

    await waitFor(() =>
      expect(screen.getByLabelText("Taux par défaut (€)")).toHaveValue(620),
    )
    fireEvent.change(screen.getByLabelText("Taux par défaut (€)"), {
      target: { value: "700" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Enregistrer/ }))

    expect(mutate).toHaveBeenCalledWith({
      defaultPaymentDays: 45,
      defaultRate: 700,
    })
  })
})
