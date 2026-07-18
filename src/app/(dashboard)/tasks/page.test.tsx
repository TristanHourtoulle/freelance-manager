import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { DesktopTasksPage } from "./page"
import type { TaskDTO } from "@/hooks/use-tasks"

const { useTasksMock } = vi.hoisted(() => ({
  useTasksMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
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

function mockTasks(opts: { data: TaskDTO[]; isLoading?: boolean }) {
  useTasksMock.mockReturnValue({
    data: opts.data,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: opts.isLoading ?? false,
  })
}

describe("DesktopTasksPage", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
  })

  it("renders loading skeletons and no empty state during the first fetch", () => {
    mockTasks({ data: [], isLoading: true })

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

  it("surfaces the a-facturer pipeline total and count in the sub-header", () => {
    mockTasks({
      data: [
        buildTask({ id: "task-1", estimate: 2 }),
        buildTask({ id: "task-2", estimate: 1, linearIdentifier: "TRI-2" }),
      ],
    })

    render(<DesktopTasksPage />)

    const accent = screen.getByText(/facturer :/)
    expect(accent.textContent?.replace(/\s+/g, " ").trim()).toBe(
      "À facturer : 1 500 €",
    )
    expect(screen.getByText("(2 tasks)")).toBeInTheDocument()
  })
})
