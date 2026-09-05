import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fmtEUR } from "@/lib/format"
import type { QuoteDetail } from "@/hooks/use-quotes"

function normalized(value: string | null): string {
  return (value ?? "").replace(/\s/g, " ")
}

function totalText(): string {
  const row = screen.getByText("Total").parentElement as HTMLElement
  return normalized(within(row).getByText(/€/).textContent ?? "")
}

const h = vi.hoisted(() => ({
  push: vi.fn(),
  updateMutate: vi.fn(),
  clients: [
    {
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
    },
  ] as Record<string, unknown>[],
}))

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
  useCreateQuote: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateQuote: () => ({ mutate: h.updateMutate, isPending: false }),
}))

import { MobileEditQuotePage } from "./mobile"

function makeQuote(overrides: Partial<QuoteDetail> = {}): QuoteDetail {
  return {
    id: "q1",
    number: "D-2026-001",
    clientId: "c1",
    projectId: null,
    status: "DRAFT",
    issueDate: "2026-07-01T00:00:00.000Z",
    validUntil: null,
    sentAt: null,
    decidedAt: null,
    subtotal: 500,
    total: 500,
    notes: null,
    externalUrl: null,
    linesCount: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      billingMode: "DAILY",
      color: null,
    },
    lines: [{ id: "l1", taskId: null, label: "Ligne existante", qty: 1, rate: 500 }],
    ...overrides,
  }
}

beforeEach(() => {
  h.push.mockReset()
  h.updateMutate.mockReset()
})

describe("MobileEditQuotePage", () => {
  it("renders the quote number in the topbar title", () => {
    render(<MobileEditQuotePage quote={makeQuote()} />)
    expect(screen.getByText("Modifier D-2026-001")).toBeInTheDocument()
  })

  it("shows the client as a disabled field, not a picker", () => {
    render(<MobileEditQuotePage quote={makeQuote()} />)
    expect(screen.getByLabelText("Client")).toBeDisabled()
    expect(screen.getByLabelText("Client")).toHaveValue("Analytical")
  })

  it("renders the existing line and recomputes the total on edit", async () => {
    const user = userEvent.setup()
    render(<MobileEditQuotePage quote={makeQuote()} />)

    expect(screen.getByLabelText("Description de la ligne")).toHaveValue(
      "Ligne existante",
    )
    expect(totalText()).toBe(normalized(fmtEUR(500)))

    const qty = screen.getByLabelText("Quantité")
    await user.clear(qty)
    await user.type(qty, "3")

    expect(totalText()).toBe(normalized(fmtEUR(1500)))
  })

  it("calls the update mutation once when saving", async () => {
    const user = userEvent.setup()
    render(<MobileEditQuotePage quote={makeQuote()} />)

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(h.updateMutate).toHaveBeenCalledTimes(1)
    const [payload] = h.updateMutate.mock.calls[0] ?? []
    expect(payload).toMatchObject({ status: "DRAFT" })
  })

  it("navigates back to the quote's drawer on back", async () => {
    const user = userEvent.setup()
    render(<MobileEditQuotePage quote={makeQuote()} />)

    await user.click(screen.getByLabelText("Retour"))
    expect(h.push).toHaveBeenCalledWith("/quotes?openId=q1")
  })
})
