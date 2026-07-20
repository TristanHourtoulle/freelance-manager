import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach } from "vitest"
import ClientsPage from "./page"
import type { ClientDTO } from "@/hooks/use-clients"

const {
  useClientsMock,
  useClientsBillableMock,
  useClientsRecencyMock,
  pushMock,
} = vi.hoisted(() => ({
  useClientsMock: vi.fn(),
  useClientsBillableMock: vi.fn(),
  useClientsRecencyMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
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
  useClientsRecency: () => useClientsRecencyMock(),
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
    stage: "ACTIVE",
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
    useClientsRecencyMock.mockReset()
    useClientsRecencyMock.mockReturnValue({ data: { byClient: {} } })
    pushMock.mockReset()
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

  it("badges a silent client from the server-side recency aggregate", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))
    useClientsRecencyMock.mockReturnValue({
      data: {
        byClient: {
          "client-1": {
            lastContactAt: "2026-01-01T00:00:00.000Z",
            silentDays: 62,
            isSilent: true,
          },
        },
      },
    })

    render(<ClientsPage />)

    expect(
      screen.getAllByText("Silencieux depuis 62 j").length,
    ).toBeGreaterThan(0)
  })

  it("shows no silence badge for a recently contacted client", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))
    useClientsRecencyMock.mockReturnValue({
      data: {
        byClient: {
          "client-1": {
            lastContactAt: "2026-03-01T00:00:00.000Z",
            silentDays: 3,
            isSilent: false,
          },
        },
      },
    })

    render(<ClientsPage />)

    expect(screen.queryByText(/Silencieux depuis/)).not.toBeInTheDocument()
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

  it("renders the Prospects and Dormants chips with their counts", () => {
    useClientsMock.mockReturnValue(
      clientsResult({
        data: [
          buildClient({ id: "client-1", stage: "LEAD" }),
          buildClient({ id: "client-2", stage: "ACTIVE" }),
          buildClient({ id: "client-3", stage: "DORMANT" }),
        ],
      }),
    )

    render(<ClientsPage />)

    expect(
      screen.getByRole("button", { name: /Prospects\s*1/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Dormants\s*1/ }),
    ).toBeInTheDocument()
  })

  it("filters the list to LEAD rows when Prospects is selected", () => {
    useClientsMock.mockReturnValue(
      clientsResult({
        data: [
          buildClient({
            id: "client-1",
            stage: "LEAD",
            company: "Lead SAS",
          }),
          buildClient({
            id: "client-2",
            stage: "ACTIVE",
            company: "Active SAS",
          }),
        ],
      }),
    )

    const { container } = render(<ClientsPage />)
    fireEvent.click(screen.getByRole("button", { name: /Prospects/ }))

    const cards = container.querySelectorAll(".client-card")
    expect(cards).toHaveLength(1)
    expect(cards[0]!.textContent).toContain("Lead SAS")
  })

  it("badges a LEAD row and leaves an ACTIVE row unbadged", () => {
    useClientsMock.mockReturnValue(
      clientsResult({ data: [buildClient({ stage: "LEAD" })] }),
    )
    const lead = render(<ClientsPage />)
    expect(screen.getByText("Prospect")).toBeInTheDocument()
    lead.unmount()

    useClientsMock.mockReturnValue(
      clientsResult({ data: [buildClient({ stage: "ACTIVE" })] }),
    )
    render(<ClientsPage />)
    expect(screen.queryByText("Prospect")).not.toBeInTheDocument()
    expect(screen.queryByText("Dormant")).not.toBeInTheDocument()
  })

  it("requests archived clients when the archived chip is toggled", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))

    render(<ClientsPage />)

    fireEvent.click(screen.getByRole("button", { name: /Archivés/i }))

    expect(useClientsMock).toHaveBeenCalledWith({ archived: true })
  })

  it("exposes each grid card as a real button", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))

    const { container } = render(<ClientsPage />)

    const card = container.querySelector(".client-card")
    expect(card?.tagName).toBe("BUTTON")
    expect(card).toHaveAttribute("type", "button")
  })

  it("reaches and activates a grid card with the keyboard only", async () => {
    const user = userEvent.setup()
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))

    const { container } = render(<ClientsPage />)
    const card = container.querySelector(".client-card") as HTMLElement

    for (let i = 0; i < 30 && document.activeElement !== card; i++) {
      await user.tab()
    }

    expect(document.activeElement).toBe(card)

    await user.keyboard("{Enter}")

    expect(pushMock).toHaveBeenCalledWith("/clients/client-1")
  })

  it("labels the pending column exactly as the design reference", () => {
    useClientsMock.mockReturnValue(clientsResult({ data: [buildClient()] }))

    const { container } = render(<ClientsPage />)

    const toggles = container.querySelectorAll(".icon-btn")
    expect(toggles).toHaveLength(2)
    fireEvent.click(toggles[1] as Element)

    expect(screen.getByRole("columnheader", { name: "Pending" })).toBeVisible()
    expect(
      screen.queryByRole("columnheader", { name: "À facturer" }),
    ).not.toBeInTheDocument()
  })
})
