import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { DesktopTasksPage } from "./page"
import type { TaskDTO } from "@/hooks/use-tasks"

const {
  useTasksMock,
  useTaskCountsMock,
  useClientsBillableMock,
  useSettingsMock,
  searchParamsMock,
  setBillabilityMock,
  bulkBillabilityMock,
} = vi.hoisted(() => ({
  useTasksMock: vi.fn(),
  useTaskCountsMock: vi.fn(),
  useClientsBillableMock: vi.fn(),
  useSettingsMock: vi.fn(),
  searchParamsMock: vi.fn<(key: string) => string | null>(() => null),
  setBillabilityMock: vi.fn(),
  bulkBillabilityMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/tasks",
  useSearchParams: () => ({
    get: (key: string) => searchParamsMock(key),
    toString: () => "",
  }),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => useTasksMock(),
  useTaskCounts: () => useTaskCountsMock(),
  useSyncLinear: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTaskEffort: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTaskBillability: () => ({
    mutate: setBillabilityMock,
    isPending: false,
  }),
  useBulkSetTaskBillability: () => ({
    mutate: bulkBillabilityMock,
    isPending: false,
  }),
}))

vi.mock("@/hooks/use-linear-sync", () => ({
  useLinearSyncProgress: () => ({
    isRunning: false,
    currentLabel: null,
    countLabel: null,
    buttonLabel: "Synchronisation…",
    doneMappings: 0,
    totalMappings: 0,
  }),
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
        category: "FREELANCE",
        archivedAt: null,
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

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => useSettingsMock(),
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

function buildTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    linearIssueId: "li-1",
    linearIdentifier: "TRI-1",
    linearUrl: null,
    title: "Implementer le dashboard",
    status: "PENDING_INVOICE",
    priority: "NONE",
    estimate: 2,
    actualDays: null,
    completedAt: null,
    invoiceId: null,
    clientId: "client-1",
    projectId: "project-1",
    billable: true,
    nonBillableReason: null,
    nonBillableNote: null,
    ...overrides,
  }
}

function countsFromTasks(tasks: TaskDTO[]) {
  return {
    all: tasks.filter((t) =>
      ["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status),
    ).length,
    pending: tasks.filter((t) => t.status === "PENDING_INVOICE").length,
    done: tasks.filter((t) => t.status === "DONE").length,
    in_progress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    invoiced: tasks.filter((t) => t.invoiceId != null).length,
    non_billable: tasks.filter((t) => !t.billable).length,
    unestimatedCount: tasks.filter(
      (t) =>
        t.status === "PENDING_INVOICE" &&
        t.billable &&
        t.invoiceId === null &&
        t.estimate === null,
    ).length,
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
  useTaskCountsMock.mockReturnValue(
    opts.isPending
      ? { data: undefined, isPending: true }
      : { data: countsFromTasks(opts.data), isPending: false },
  )
}

function mockBillable(totalCount: number, totalValue: number) {
  useClientsBillableMock.mockReturnValue({
    data: { byClient: {}, totalCount, totalValue },
  })
}

function mockLastSync(linearLastSyncedAt: string | null) {
  useSettingsMock.mockReturnValue({ data: { linearLastSyncedAt } })
}

function subHeaderText() {
  const node = document.querySelector(".page-sub")
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim()
}

describe("DesktopTasksPage", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useTaskCountsMock.mockReset()
    useClientsBillableMock.mockReset()
    useSettingsMock.mockReset()
    searchParamsMock.mockReset()
    searchParamsMock.mockReturnValue(null)
    mockBillable(0, 0)
    mockLastSync(null)
  })

  it("renders loading skeletons and no empty state during the first fetch", () => {
    mockTasks({ data: [], isPending: true })

    const { container } = render(<DesktopTasksPage />)

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Aucune task")).not.toBeInTheDocument()
    expect(screen.queryByText("Aucun resultat")).not.toBeInTheDocument()
  })

  it("shows the design's empty state verbatim when there is genuinely no task", () => {
    mockTasks({ data: [] })

    const { container } = render(<DesktopTasksPage />)

    expect(container.querySelectorAll(".skeleton").length).toBe(0)
    expect(screen.getByText("Aucune task")).toBeInTheDocument()
    expect(
      screen.getByText("Ajuste les filtres ou lance une sync"),
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

  it("renders the design's three sub-header segments in order when nothing is billable", () => {
    mockTasks({ data: [buildTask()] })
    mockLastSync(new Date().toISOString())

    render(<DesktopTasksPage />)

    expect(subHeaderText()).toBe(
      "Synchronisées depuis Linear · 1 tasks visibles · dernière sync aujourd'hui",
    )
  })

  it("appends the a-facturer segment after the design's three segments", () => {
    mockTasks({ data: [buildTask()] })
    mockLastSync(new Date(Date.now() - 2 * 86400000).toISOString())
    mockBillable(2, 1500)

    render(<DesktopTasksPage />)

    expect(subHeaderText()).toBe(
      "Synchronisées depuis Linear · 1 tasks visibles · dernière sync il y a 2j Sync ancienne · À facturer : 1 500 € (2 tasks)",
    )
  })

  it("flags a sync older than 24h with the warning pill", () => {
    mockTasks({ data: [buildTask()] })
    mockLastSync(new Date(Date.now() - 25 * 3600000).toISOString())

    render(<DesktopTasksPage />)

    expect(screen.getByText("Sync ancienne")).toHaveClass("pill-partial")
  })

  it("shows no staleness warning for a sync within the last 24h", () => {
    mockTasks({ data: [buildTask()] })
    mockLastSync(new Date(Date.now() - 3600000).toISOString())

    render(<DesktopTasksPage />)

    expect(screen.queryByText("Sync ancienne")).not.toBeInTheDocument()
  })

  it("falls back to the em dash when no Linear sync has ever run", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)

    expect(subHeaderText()).toContain("dernière sync —")
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

    expect(screen.getByText("Aucune task à facturer")).toBeInTheDocument()
    expect(screen.queryByText("Aucune task")).not.toBeInTheDocument()
    expect(
      screen.queryByText("Ajuste les filtres ou lance une sync"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /initialiser les filtres/ }),
    ).not.toBeInTheDocument()
  })

  it("widens to the active scope in one click and still explains backlog-only data", () => {
    mockTasks({ data: [buildTask({ status: "BACKLOG" })] })

    render(<DesktopTasksPage />)

    fireEvent.click(
      screen.getByRole("button", { name: "Voir toutes les tasks" }),
    )

    expect(screen.getByText("Aucune task active")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Toutes tes tasks sont en backlog ou annulées, elles ne sont pas affichées ici",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /initialiser les filtres/ }),
    ).not.toBeInTheDocument()
  })

  it("defaults the status filter to À facturer and hides other statuses", () => {
    mockTasks({
      data: [
        buildTask(),
        buildTask({
          id: "task-2",
          linearIdentifier: "TRI-2",
          title: "Task done",
          status: "DONE",
        }),
      ],
    })

    render(<DesktopTasksPage />)

    expect(screen.getByRole("button", { name: /^À facturer/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()
    expect(screen.queryByText("Task done")).not.toBeInTheDocument()
  })

  it("reports the visible count of the active status filter in the sub-header", () => {
    mockTasks({
      data: [
        buildTask(),
        buildTask({
          id: "task-2",
          linearIdentifier: "TRI-2",
          title: "Task done",
          status: "DONE",
        }),
        buildTask({
          id: "task-3",
          linearIdentifier: "TRI-3",
          title: "Autre task done",
          status: "DONE",
        }),
      ],
    })

    render(<DesktopTasksPage />)

    expect(subHeaderText()).toContain("1 tasks visibles")

    fireEvent.click(screen.getByRole("button", { name: /^Tout/ }))

    expect(subHeaderText()).toContain("3 tasks visibles")
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

  it("no longer renders the Dev/Suivi mode toggle", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)

    expect(
      screen.queryByRole("button", { name: "Dev" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Suivi" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()
  })
})

function normalize(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim()
}

function selectFirstRow() {
  const rowCheckbox = screen.getAllByRole("checkbox")[1]
  expect(rowCheckbox).toBeDefined()
  fireEvent.click(rowCheckbox!)
}

describe("DesktopTasksPage billability", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useTaskCountsMock.mockReset()
    useClientsBillableMock.mockReset()
    useSettingsMock.mockReset()
    searchParamsMock.mockReset()
    setBillabilityMock.mockReset()
    bulkBillabilityMock.mockReset()
    searchParamsMock.mockReturnValue(null)
    mockBillable(0, 0)
    mockLastSync(null)
  })

  it("bulk marking opens the dialog and calls the bulk hook with ids and reason", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)
    selectFirstRow()

    fireEvent.click(
      screen.getByRole("button", { name: /Marquer non facturable/ }),
    )
    expect(
      screen.getByRole("dialog", {
        name: "Marquer 1 tâche comme non facturable",
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("radio", { name: "Travail non facturé" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(bulkBillabilityMock).toHaveBeenCalledWith(
      {
        taskIds: ["task-1"],
        billable: false,
        nonBillableReason: "NON_BILLED_WORK",
        nonBillableNote: null,
      },
      expect.anything(),
    )
  })

  it("keeps confirm disabled for OTHER until a note is provided", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)
    selectFirstRow()
    fireEvent.click(
      screen.getByRole("button", { name: /Marquer non facturable/ }),
    )
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeDisabled()
    expect(
      screen.getByText("Une note est requise pour la raison « Autre »."),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: "Refonte offerte" },
    })

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))
    expect(bulkBillabilityMock).toHaveBeenCalledWith(
      {
        taskIds: ["task-1"],
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "Refonte offerte",
      },
      expect.anything(),
    )
  })

  it("renders a non-billable row muted with its reason pill and a dash value", () => {
    mockTasks({
      data: [
        buildTask({
          billable: false,
          nonBillableReason: "COMMERCIAL_GESTURE",
        }),
      ],
    })

    render(<DesktopTasksPage />)

    const row = screen.getByText("TRI-1").closest("tr")
    expect(row).not.toBeNull()
    expect(row).toHaveStyle({ opacity: "0.55" })
    expect(within(row!).getByText("Geste commercial")).toBeInTheDocument()

    const cells = within(row!).getAllByRole("cell")
    expect(normalize(cells[6]?.textContent)).toBe("—")
  })

  it("counts only pipeline-eligible tasks in the group value", () => {
    mockTasks({
      data: [
        buildTask(),
        buildTask({ id: "task-2", linearIdentifier: "TRI-2", status: "DONE" }),
      ],
    })

    const { container } = render(<DesktopTasksPage />)
    fireEvent.click(screen.getByRole("button", { name: /^Tout/ }))

    expect(screen.getByText("TRI-2")).toBeInTheDocument()
    const groupValue = container.querySelector(".card .num.strong")
    expect(normalize(groupValue?.textContent)).toBe("1 000 €")
  })

  it("filters to non-billable tasks via the Non facturable chip with its count", () => {
    mockTasks({
      data: [
        buildTask({ title: "Task facturable" }),
        buildTask({
          id: "task-2",
          linearIdentifier: "TRI-2",
          title: "Task offerte",
          billable: false,
          nonBillableReason: "NON_BILLED_WORK",
        }),
      ],
    })

    render(<DesktopTasksPage />)

    const chip = screen.getByRole("button", { name: "Non facturable 1" })
    fireEvent.click(chip)

    expect(screen.getByText("Task offerte")).toBeInTheDocument()
    expect(screen.queryByText("Task facturable")).not.toBeInTheDocument()
  })

  it("surfaces the count of billable pending tasks without estimate", () => {
    mockTasks({
      data: [
        buildTask({ estimate: null }),
        buildTask({
          id: "task-2",
          linearIdentifier: "TRI-2",
          estimate: null,
          billable: false,
          nonBillableReason: "NON_BILLED_WORK",
        }),
        buildTask({ id: "task-3", linearIdentifier: "TRI-3" }),
      ],
    })

    render(<DesktopTasksPage />)

    expect(screen.getByText("1 à estimer")).toBeInTheDocument()
  })

  it("hides the a-estimer warning when every pending task is estimated", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)

    expect(screen.queryByText(/à estimer/)).not.toBeInTheDocument()
  })

  it("restores an all-non-billable selection without any dialog", () => {
    mockTasks({
      data: [
        buildTask({
          billable: false,
          nonBillableReason: "COMMERCIAL_GESTURE",
        }),
      ],
    })

    render(<DesktopTasksPage />)
    selectFirstRow()

    fireEvent.click(screen.getByRole("button", { name: /Marquer facturable/ }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(bulkBillabilityMock).toHaveBeenCalledWith(
      {
        taskIds: ["task-1"],
        billable: true,
        nonBillableReason: null,
        nonBillableNote: null,
      },
      expect.anything(),
    )
  })

  it("marks a single task non-billable from its row action through the dialog", () => {
    mockTasks({ data: [buildTask()] })

    render(<DesktopTasksPage />)

    fireEvent.click(
      screen.getByRole("button", { name: "Marquer TRI-1 non facturable" }),
    )
    fireEvent.click(screen.getByRole("radio", { name: "Bug déjà facturé" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(setBillabilityMock).toHaveBeenCalledWith(
      {
        id: "task-1",
        billable: false,
        nonBillableReason: "BUG_FIX_ALREADY_INVOICED",
        nonBillableNote: null,
      },
      expect.anything(),
    )
  })

  it("restores a single non-billable task directly from its row action", () => {
    mockTasks({
      data: [
        buildTask({
          billable: false,
          nonBillableReason: "NON_BILLED_WORK",
        }),
      ],
    })

    render(<DesktopTasksPage />)

    fireEvent.click(
      screen.getByRole("button", { name: "Remettre TRI-1 en facturation" }),
    )

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(setBillabilityMock).toHaveBeenCalledWith({
      id: "task-1",
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
    })
  })
})
