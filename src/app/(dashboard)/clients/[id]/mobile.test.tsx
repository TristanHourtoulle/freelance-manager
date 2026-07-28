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
