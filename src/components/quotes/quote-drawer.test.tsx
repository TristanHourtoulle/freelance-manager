import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { QuoteDrawer } from "./quote-drawer"
import type { QuoteDetail } from "@/domain/quotes/types"

const { useQuoteMock } = vi.hoisted(() => ({
  useQuoteMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-quotes", () => ({
  useQuote: (id: string) => useQuoteMock(id),
  useSetQuoteStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteQuote: () => ({ mutate: vi.fn(), isPending: false }),
}))

function buildQuote(overrides: Partial<QuoteDetail> = {}): QuoteDetail {
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
    subtotal: 1000,
    total: 1000,
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
    lines: [{ id: "l1", taskId: null, label: "Audit", qty: 2, rate: 500 }],
    ...overrides,
  }
}

function renderDrawer(overrides: Partial<QuoteDetail> = {}) {
  useQuoteMock.mockReturnValue({ data: buildQuote(overrides), isLoading: false })
  render(<QuoteDrawer quoteId="q1" onClose={vi.fn()} />)
}

describe("QuoteDrawer status actions", () => {
  it("shows only Modifier and Supprimer, no send/decision actions, for a DRAFT quote", () => {
    renderDrawer({ status: "DRAFT" })

    expect(screen.getByRole("button", { name: /Modifier/ })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Marquer envoyé/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer accepté/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer refusé/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Supprimer/ })).toBeInTheDocument()
  })

  it("shows the accept/refuse decision actions, not the send action, for a SENT quote", () => {
    renderDrawer({ status: "SENT" })

    expect(
      screen.queryByRole("button", { name: /Marquer envoyé/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Marquer accepté/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Marquer refusé/ }),
    ).toBeInTheDocument()
  })

  it("shows only Modifier and Supprimer for an already-decided ACCEPTED quote", () => {
    renderDrawer({ status: "ACCEPTED" })

    expect(
      screen.queryByRole("button", { name: /Marquer envoyé/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer accepté/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer refusé/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Modifier/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Supprimer/ })).toBeInTheDocument()
  })

  it("shows only Modifier and Supprimer for a REFUSED quote", () => {
    renderDrawer({ status: "REFUSED" })

    expect(
      screen.queryByRole("button", { name: /Marquer accepté/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer refusé/ }),
    ).not.toBeInTheDocument()
  })

  it("shows only Modifier and Supprimer for an EXPIRED quote", () => {
    renderDrawer({ status: "EXPIRED" })

    expect(
      screen.queryByRole("button", { name: /Marquer envoyé/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer accepté/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Marquer refusé/ }),
    ).not.toBeInTheDocument()
  })

  it("renders the Abby link only when externalUrl is set", () => {
    renderDrawer({ externalUrl: null })
    expect(
      screen.queryByRole("link", { name: /Voir sur Abby/ }),
    ).not.toBeInTheDocument()

    renderDrawer({ externalUrl: "https://abby.fr/devis/1" })
    expect(screen.getByRole("link", { name: /Voir sur Abby/ })).toHaveAttribute(
      "href",
      "https://abby.fr/devis/1",
    )
  })

  it("shows a loading skeleton while the quote is fetching", () => {
    useQuoteMock.mockReturnValue({ data: undefined, isLoading: true })
    render(<QuoteDrawer quoteId="q1" onClose={vi.fn()} />)

    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /Modifier/ }),
    ).not.toBeInTheDocument()
  })
})
