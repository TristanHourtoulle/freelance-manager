import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileClientDetailPage } from "./mobile"
import { deriveClientBilling } from "@/domain/clients/billing"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"

const { useClientDetailMock } = vi.hoisted(() => ({
  useClientDetailMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-client-detail", async () => {
  const actual = await vi.importActual<
    typeof import("@/hooks/use-client-detail")
  >("@/hooks/use-client-detail")
  return {
    ...actual,
    useClientDetail: (id: string) => useClientDetailMock(id),
    useClientActivity: () => ({ data: [] }),
  }
})

vi.mock("@/components/clients/edit-client-modal", () => ({
  EditClientModal: () => null,
}))

vi.mock("@/components/clients/client-actions-menu", () => ({
  ClientActionsMenu: () => null,
}))

vi.mock("@/components/clients/client-standing-card", () => ({
  ClientStandingCard: () => null,
}))

vi.mock("@/components/clients/client-notes-card", () => ({
  ClientNotesCard: () => null,
}))

vi.mock("@/components/clients/client-activity-timeline", () => ({
  ClientActivityTimeline: () => null,
}))

vi.mock("@/components/suivi/suivi-view", () => ({
  SuiviView: () => null,
}))

type Task = ClientDetailDTO["tasks"][number]

function task(overrides: Partial<Task>): Task {
  return {
    id: "t",
    linearIdentifier: "TRI-1",
    linearUrl: null,
    title: "Task",
    status: "PENDING_INVOICE",
    estimate: 1,
    projectId: "p1",
    invoiceId: null,
    billable: true,
    ...overrides,
  }
}

function buildClient(
  overrides: Partial<ClientDetailDTO> = {},
): ClientDetailDTO {
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
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    workload: {
      days: 0,
      taskCount: 0,
      estimatedTaskCount: 0,
      missingEstimateCount: 0,
    },
    lastContactAt: null,
    meetings: [],
    openActions: [],
    monthlyRevenue: [],
    projects: [],
    linearMappings: [],
    tasks: [],
    invoices: [],
    ...overrides,
  }
}

function renderWithClient(client: ClientDetailDTO) {
  useClientDetailMock.mockReturnValue({ data: client, isLoading: false })
  return render(<MobileClientDetailPage id={client.id} />)
}

function pendingTileValue(): string | null | undefined {
  return screen
    .getByText("À facturer")
    .parentElement?.querySelector(".kpi-value")?.textContent
}

type Invoice = ClientDetailDTO["invoices"][number]

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
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
    lateFeeAccrued: 0,
    lateFeeDue: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    total: 1000,
    linesCount: 1,
    ...overrides,
  }
}

describe("MobileClientDetailPage pipeline gate", () => {
  it("counts only pipeline-eligible tasks in À facturer and the CTA", () => {
    renderWithClient(
      buildClient({
        tasks: [
          task({ id: "a" }),
          task({ id: "b", invoiceId: "inv-1" }),
          task({ id: "c", billable: false }),
          task({ id: "d", status: "DONE" }),
          task({ id: "e", status: "BACKLOG" }),
        ],
      }),
    )

    expect(pendingTileValue()).toBe("1")
    expect(screen.getByText("Facturer (1)")).toBeInTheDocument()
  })

  it("shows zero and hides the CTA for an archived client", () => {
    renderWithClient(
      buildClient({
        archived: true,
        archivedAt: "2026-06-01T00:00:00.000Z",
        tasks: [task({ id: "a" })],
      }),
    )

    expect(pendingTileValue()).toBe("0")
    expect(screen.queryByText(/^Facturer \(/)).not.toBeInTheDocument()
  })

  it("shows zero and hides the CTA for a non-freelance client", () => {
    renderWithClient(
      buildClient({
        category: "PERSONAL",
        tasks: [task({ id: "a" })],
      }),
    )

    expect(pendingTileValue()).toBe("0")
    expect(screen.queryByText(/^Facturer \(/)).not.toBeInTheDocument()
  })

  it("matches the desktop deriveClientBilling set for the same input", () => {
    const client = buildClient({
      tasks: [
        task({ id: "a" }),
        task({ id: "b", estimate: null }),
        task({ id: "c", invoiceId: "inv-1" }),
        task({ id: "d", billable: false }),
        task({ id: "e", status: "IN_PROGRESS" }),
      ],
    })
    const { billableTasks } = deriveClientBilling(client)

    renderWithClient(client)

    expect(pendingTileValue()).toBe(String(billableTasks.length))
    expect(
      screen.getByText(`Facturer (${billableTasks.length})`),
    ).toBeInTheDocument()
  })
})

describe("MobileClientDetailPage overdue tile", () => {
  it("adds the missing En retard tile, matching the desktop hero", () => {
    renderWithClient(
      buildClient({
        invoices: [invoice({ id: "a" }), invoice({ id: "b", isOverdue: false })],
      }),
    )

    const overdueValue = screen
      .getByText("En retard")
      .parentElement?.querySelector(".kpi-value")?.textContent
    expect(overdueValue).toBe("1")
  })

  it("shows the cumulative unclaimed penalty under the En retard tile", () => {
    renderWithClient(
      buildClient({
        invoices: [invoice({ id: "a", lateFeeAccrued: 58.69 })],
      }),
    )

    expect(
      screen.getByText(/dont 58,69 €/, { selector: "div" }),
    ).toBeInTheDocument()
  })

  it("excludes a waived penalty from the En retard sub-label", () => {
    renderWithClient(
      buildClient({
        invoices: [
          invoice({ id: "a", lateFeeAccrued: 58.69, lateFeeWaived: true }),
        ],
      }),
    )

    expect(screen.queryByText(/dont/)).not.toBeInTheDocument()
  })
})
