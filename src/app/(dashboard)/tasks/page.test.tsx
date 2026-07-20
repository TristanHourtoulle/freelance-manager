import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { DesktopTasksPage } from "./page"
import type { TaskDTO } from "@/hooks/use-tasks"

const { useTasksMock, useClientsBillableMock, searchParamsMock } = vi.hoisted(
  () => ({
    useTasksMock: vi.fn(),
    useClientsBillableMock: vi.fn(),
    searchParamsMock: vi.fn<(key: string) => string | null>(() => null),
  }),
)

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => searchParamsMock(key) }),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => useTasksMock(),
  useSyncLinear: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({
    data: [
      {
        id: "client-1",
        firstName: "Henri",
        lastName: "Mistral",
        company: "Mistral SAS",
        billingMode: "DAILY",
        rate: 500,
        color: null,
      },
    ],
  }),
  useClientsBillable: () => useClientsBillableMock(),
}))

vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => ({
    data: [{ id: "project-1", clientId: "client-1", name: "Refonte" }],
  }),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: () => ({ data: [] }),
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/components/suivi/suivi-view", () => ({
  SuiviView: () => null,
}))

function buildTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    linearIssueId: "li-1",
    linearIdentifier: "TRI-1",
    title: "Implementer le dashboard",
    status: "PENDING_INVOICE",
    priority: "NONE",
    estimate: 2,
    completedAt: null,
    invoiceId: null,
    clientId: "client-1",
    projectId: "project-1",
    ...overrides,
  }
}

function mockTasks(opts: { data: TaskDTO[]; isPending?: boolean }) {
  useTasksMock.mockReturnValue({
    data: opts.data,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isPending: opts.isPending ?? false,
  })
}

function mockBillable(totalCount: number, totalValue: number) {
  useClientsBillableMock.mockReturnValue({
    data: { byClient: {}, totalCount, totalValue },
  })
}

describe("DesktopTasksPage", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useClientsBillableMock.mockReset()
    searchParamsMock.mockReset()
    searchParamsMock.mockReturnValue(null)
    mockBillable(0, 0)
  })

  it("renders loading skeletons and no empty state during the first fetch", () => {
    mockTasks({ data: [], isPending: true })

    const { container } = render(<DesktopTasksPage />)

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Aucune task")).not.toBeInTheDocument()
    expect(screen.queryByText("Aucun resultat")).not.toBeInTheDocument()
  })

  it("shows the sync-prompt empty state when there is genuinely no task", () => {
    mockTasks({ data: [] })

    const { container } = render(<DesktopTasksPage />)

    expect(container.querySelectorAll(".skeleton").length).toBe(0)
    expect(screen.getByText("Aucune task")).toBeInTheDocument()
    expect(
      screen.getByText("Lance une sync Linear pour importer tes issues"),
    ).toBeInTheDocument()
  })

  it("shows the filtered-no-match empty state with a reset button, and reset restores the list", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)

    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()

    fireEvent.change(
      screen.getByPlaceholderText(/Rechercher par ID ou titre/),
      { target: { value: "zzz-no-match" } },
    )

    const resetButton = screen.getByRole("button", {
      name: /initialiser les filtres/,
    })
    expect(resetButton).toBeInTheDocument()
    expect(screen.queryByText("Aucune task")).not.toBeInTheDocument()

    fireEvent.click(resetButton)

    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()
  })

  it("surfaces the server-side a-facturer total and count in the sub-header", () => {
    mockTasks({ data: [buildTask()] })
    mockBillable(2, 1500)

    render(<DesktopTasksPage />)

    const accent = screen.getByText(/facturer :/)
    expect(accent.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "À facturer : 1 500 €",
    )
    expect(screen.getByText("(2 tasks)")).toBeInTheDocument()
  })

  it("keeps the a-facturer total global when it exceeds the loaded task page", () => {
    mockTasks({ data: [buildTask()] })
    mockBillable(120, 60000)

    render(<DesktopTasksPage />)

    expect(screen.getByText("(120 tasks)")).toBeInTheDocument()
  })

  it("never reports a count without its euro amount for FIXED-only pipelines", () => {
    mockTasks({ data: [buildTask()] })
    mockBillable(1, 0)

    render(<DesktopTasksPage />)

    const accent = screen.getByText(/facturer :/)
    expect(accent.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "À facturer : 0 €",
    )
    expect(screen.getByText("(1 task)")).toBeInTheDocument()
  })

  it("explains the default status scope instead of blaming filters nobody set", () => {
    mockTasks({ data: [buildTask({ status: "BACKLOG" })] })

    render(<DesktopTasksPage />)

    expect(screen.getByText("Aucune task active")).toBeInTheDocument()
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /initialiser les filtres/ }),
    ).not.toBeInTheDocument()
  })

  it("applies the clientId search param on mount", () => {
    mockTasks({ data: [buildTask()] })
    searchParamsMock.mockImplementation((key) =>
      key === "clientId" ? "client-other" : null,
    )

    render(<DesktopTasksPage />)

    expect(
      screen.queryByText("Implementer le dashboard"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument()
  })

  it("follows a clientId search param that changes while the page stays mounted", () => {
    mockTasks({ data: [buildTask()] })

    const { rerender } = render(<DesktopTasksPage />)
    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()

    searchParamsMock.mockImplementation((key) =>
      key === "clientId" ? "client-other" : null,
    )
    rerender(<DesktopTasksPage />)

    expect(
      screen.queryByText("Implementer le dashboard"),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument()
  })
})
