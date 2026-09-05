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

vi.mock("@/components/clients/client-notes-card", () => ({
  ClientNotesCard: () => null,
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
    workload: {
      days: 6,
      taskCount: 3,
      estimatedTaskCount: 2,
      missingEstimateCount: 1,
    },
    rate: 500,
    fixedPrice: null,
    deposit: null,
    paymentTerms: null,
    category: "FREELANCE",
    color: null,
    starred: false,
    archived: false,
    archivedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    lastContactAt: null,
    meetings: [],
    openActions: [],
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

  it("shows the cumulative unclaimed penalty under the overdue tile", () => {
    useClientDetailMock.mockReturnValue({
      data: {
        ...buildClient(),
        invoices: [
          {
            id: "inv-1",
            number: "F-2026-001",
            status: "SENT",
            paymentStatus: "PARTIALLY_PAID",
            isOverdue: true,
            kind: "STANDARD",
            issueDate: "2026-07-01",
            dueDate: "2026-07-31",
            paidAmount: 0,
            balanceDue: 1000,
            lateFeeAccrued: 58.69,
            lateFeeDue: 0,
            lateFeeClaimedAt: null,
            lateFeeWaived: false,
            total: 1000,
            linesCount: 1,
          },
        ],
      },
      isLoading: false,
    })

    renderPage()

    expect(
      screen.getByText(/dont 58,69 €/, { selector: "span" }),
    ).toBeInTheDocument()
  })

  it("excludes a waived penalty from the cumulative overdue sub-label", () => {
    useClientDetailMock.mockReturnValue({
      data: {
        ...buildClient(),
        invoices: [
          {
            id: "inv-1",
            number: "F-2026-001",
            status: "SENT",
            paymentStatus: "PARTIALLY_PAID",
            isOverdue: true,
            kind: "STANDARD",
            issueDate: "2026-07-01",
            dueDate: "2026-07-31",
            paidAmount: 0,
            balanceDue: 1000,
            lateFeeAccrued: 58.69,
            lateFeeDue: 0,
            lateFeeClaimedAt: null,
            lateFeeWaived: true,
            total: 1000,
            linesCount: 1,
          },
        ],
      },
      isLoading: false,
    })

    renderPage()

    expect(screen.queryByText(/dont 58,69 €/)).not.toBeInTheDocument()
    expect(screen.getByText("à relancer")).toBeInTheDocument()
  })
})
