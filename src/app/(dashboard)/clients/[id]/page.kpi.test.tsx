import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DesktopClientDetailPage, HERO_KPI_COUNT } from "./page"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"

const { useClientDetailMock } = vi.hoisted(() => ({
  useClientDetailMock: vi.fn(),
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

vi.mock("@/hooks/use-client-detail", () => ({
  useClientDetail: () => useClientDetailMock(),
  useClientActivity: () => ({ data: [] }),
}))

vi.mock("./mobile", () => ({
  MobileClientDetailPage: () => null,
}))

vi.mock("@/components/clients/client-actions-menu", () => ({
  ClientActionsMenu: () => null,
}))

vi.mock("@/components/clients/client-revenue-chart", () => ({
  ClientRevenueChart: () => null,
}))

vi.mock("@/components/clients/client-activity-timeline", () => ({
  ClientActivityTimeline: () => null,
}))

vi.mock("@/components/suivi/suivi-view", () => ({
  SuiviView: () => null,
}))

function buildClient(): ClientDetailDTO {
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
    rate: 500,
    fixedPrice: null,
    deposit: null,
    paymentTerms: null,
    category: "FREELANCE",
    color: null,
    starred: false,
    archived: false,
    createdAt: "2026-07-01T00:00:00.000Z",
    monthlyRevenue: [],
    projects: [],
    linearMappings: [],
    tasks: [],
    invoices: [],
  }
}

function renderPage() {
  return render(<DesktopClientDetailPage id="client-1" />)
}

describe("client detail hero", () => {
  beforeEach(() => {
    useClientDetailMock.mockReset()
  })

  it("renders exactly HERO_KPI_COUNT tiles once resolved", () => {
    useClientDetailMock.mockReturnValue({
      data: buildClient(),
      isLoading: false,
    })

    const { container } = renderPage()

    const grid = container.querySelector('[data-testid="hero-kpi-grid"]')
    expect(grid?.children.length).toBe(HERO_KPI_COUNT)
  })

  it("renders the same number of skeleton tiles while loading", () => {
    useClientDetailMock.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = renderPage()

    const grid = container.querySelector('[data-testid="hero-kpi-skeleton"]')
    expect(grid?.children.length).toBe(HERO_KPI_COUNT)
    expect(screen.queryByText("Client introuvable")).not.toBeInTheDocument()
  })
})
