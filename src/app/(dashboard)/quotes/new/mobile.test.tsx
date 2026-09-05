import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fmtEUR } from "@/lib/format"

function normalized(value: string | null): string {
  return (value ?? "").replace(/\s/g, " ")
}

function totalText(): string {
  const row = screen.getByText("Total").parentElement as HTMLElement
  return normalized(within(row).getByText(/€/).textContent ?? "")
}

const h = vi.hoisted(() => {
  const client = {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical",
    email: null,
    billingMode: "DAILY",
    rate: 500,
    fixedPrice: null,
    deposit: null,
    color: null,
  }
  return {
    client,
    clients: [client] as Record<string, unknown>[],
    push: vi.fn(),
    createMutate: vi.fn(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-projects", () => ({ useProjects: () => ({ data: [] }) }))
vi.mock("@/hooks/use-tasks", () => ({ useTasks: () => ({ data: [] }) }))
vi.mock("@/hooks/use-quotes", () => ({
  useCreateQuote: () => ({ mutate: h.createMutate, isPending: false }),
  useUpdateQuote: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { MobileQuoteNewPage } from "./mobile"

beforeEach(() => {
  h.clients = [h.client]
  h.push.mockReset()
  h.createMutate.mockReset()
})

describe("MobileQuoteNewPage", () => {
  it("renders the topbar title", () => {
    render(<MobileQuoteNewPage />)
    expect(screen.getByText("Nouveau devis")).toBeInTheDocument()
  })

  it("disables the create button until a client and a line are set", async () => {
    render(<MobileQuoteNewPage />)

    const create = screen.getByRole("button", { name: "Créer le devis" })
    expect(create).toBeDisabled()

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: /Ajouter une ligne/ }))

    expect(create).toBeDisabled()
    await user.type(screen.getByLabelText("Description de la ligne"), "Audit")
    expect(create).not.toBeDisabled()
  })

  it("recomputes the total as lines are edited", async () => {
    const user = userEvent.setup()
    render(<MobileQuoteNewPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: /Ajouter une ligne/ }))
    const qty = screen.getByLabelText("Quantité")
    await user.clear(qty)
    await user.type(qty, "2")
    const rate = screen.getByLabelText("Prix unitaire")
    await user.clear(rate)
    await user.type(rate, "100")

    expect(totalText()).toBe(normalized(fmtEUR(200)))
  })

  it("submits the create payload when the CTA is pressed", async () => {
    const user = userEvent.setup()
    render(<MobileQuoteNewPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: /Ajouter une ligne/ }))
    await user.type(screen.getByLabelText("Description de la ligne"), "Audit")

    await user.click(screen.getByRole("button", { name: "Créer le devis" }))

    expect(h.createMutate).toHaveBeenCalledTimes(1)
    const [payload] = h.createMutate.mock.calls[0] ?? []
    expect(payload).toMatchObject({ clientId: "c1", status: "DRAFT" })
  })

  it("navigates back to the quotes list on back", async () => {
    const user = userEvent.setup()
    render(<MobileQuoteNewPage />)

    await user.click(screen.getByLabelText("Retour"))
    expect(h.push).toHaveBeenCalledWith("/quotes")
  })
})
