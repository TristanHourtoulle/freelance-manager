import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import ClientsPage from "./page"
import type { ClientDTO } from "@/hooks/use-clients"

const { useClientsMock, useClientsBillableMock } = vi.hoisted(() => ({
  useClientsMock: vi.fn(),
  useClientsBillableMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: (options?: { archived?: boolean }) => useClientsMock(options),
  useClientsBillable: () => useClientsBillableMock(),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: () => ({ data: [] }),
}))

vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => ({ data: [] }),
}))

function buildClient(overrides: Partial<ClientDTO> = {}): ClientDTO {
  return {
    id: "client-1",
    firstName: "Henri",
    lastName: "Mistral",
    company: "Mistral SAS",
    email: null,
    phone: null,
    website: null,
    address: null,
    notes: null,
    billingMode: "DAILY",
    rate: 600,
    fixedPrice: null,
    deposit: null,
    paymentTerms: null,
    category: "FREELANCE",
    color: null,
    starred: false,
    archived: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

function clientsResult(
  partial: {
    data?: ClientDTO[]
    isPending?: boolean
  } = {},
) {
  return {
    data: partial.data ?? [],
    isPending: partial.isPending ?? false,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }
}

function billableResult(
  byClient: Record<string, { count: number; value: number }> = {},
) {
  const entries = Object.values(byClient)
  return {
    data: {
      byClient,
      totalCount: entries.reduce((n, e) => n + e.count, 0),
      totalValue: entries.reduce((n, e) => n + e.value, 0),
    },
  }
}

describe("ClientsPage (desktop)", () => {
  beforeEach(() => {
    useClientsMock.mockReset()
    useClientsBillableMock.mockReset()
    useClientsBillableMock.mockReturnValue(billableResult())
  })

  it("renders skeletons while loading, not the empty state", () => {
    useClientsMock.mockReturnValue(clientsResult({ isPending: true }))

    const { container } = render(<ClientsPage />)

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Aucun client")).not.toBeInTheDocument()
  })

  it("shows the empty-state CTA only once the query resolves empty", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [] }))

    render(<ClientsPage />)

    expect(screen.getByText("Aucun client")).toBeInTheDocument()
    expect(
      screen.getAllByRole("button", { name: /Nouveau client/i }),
    ).toHaveLength(2)
  })

  it("reads the 'à facturer' metric from the server-side aggregate", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))
    useClientsBillableMock.mockReturnValue(
      billableResult({ "client-1": { count: 2, value: 1000 } }),
    )

    const { container } = render(<ClientsPage />)

    const card = container.querySelector(".client-card")
    expect(card?.textContent).toMatch(/2\s*à facturer/)
  })

  it("shows a billable count larger than one task page", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))
    useClientsBillableMock.mockReturnValue(
      billableResult({ "client-1": { count: 120, value: 60000 } }),
    )

    const { container } = render(<ClientsPage />)

    expect(container.querySelector(".client-card")?.textContent).toMatch(
      /120\s*à facturer/,
    )
  })

  it("shows zero rather than a stale count for a client absent from the aggregate", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))
    useClientsBillableMock.mockReturnValue(
      billableResult({ "client-other": { count: 9, value: 4500 } }),
    )

    const { container } = render(<ClientsPage />)

    expect(container.querySelector(".client-card")?.textContent).toMatch(
      /0\s*à facturer/,
    )
  })

  it("distinguishes a filter/search miss from a truly empty list", () => {
    useClientsMock.mockReturnValue(
      clientsResult({ data: [buildClient({ billingMode: "DAILY" })] }),
    )

    render(<ClientsPage />)

    fireEvent.click(screen.getByRole("button", { name: /Forfait/i }))

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument()
    expect(screen.queryByText("Aucun client")).not.toBeInTheDocument()
  })

  it("requests archived clients when the archived chip is toggled", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))

    render(<ClientsPage />)

    fireEvent.click(screen.getByRole("button", { name: /Archivés/i }))

    expect(useClientsMock).toHaveBeenCalledWith({ archived: true })
  })
})
