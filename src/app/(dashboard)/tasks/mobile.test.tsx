import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { MobileTasksPage } from "./mobile"
import type { TaskDTO } from "@/hooks/use-tasks"

const {
  useTasksMock,
  useTaskCountsMock,
  updateEffortMock,
  bulkBillabilityMock,
} = vi.hoisted(() => ({
  useTasksMock: vi.fn(),
  useTaskCountsMock: vi.fn(),
  updateEffortMock: vi.fn(),
  bulkBillabilityMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => useTasksMock(),
  useTaskCounts: () => useTaskCountsMock(),
  useSyncLinear: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTaskEffort: () => ({ mutate: updateEffortMock, isPending: false }),
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
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/components/suivi/suivi-view", () => ({
  SuiviView: () => null,
}))

function buildTask(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "task-1",
    linearIssueId: "li-1",
    linearIdentifier: "TRI-1",
    linearUrl: "https://linear.app/x/issue/TRI-1",
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

function mockTasks(data: TaskDTO[]) {
  useTasksMock.mockReturnValue({ data })
  useTaskCountsMock.mockReturnValue({
    data: countsFromTasks(data),
    isPending: false,
  })
}

function effortInput() {
  return screen.getByLabelText("Temps réel passé, en jours")
}

describe("MobileTasksPage effort capture", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useTaskCountsMock.mockReset()
    updateEffortMock.mockReset()
    mockTasks([buildTask()])
  })

  it("renders the effort input inside the task card, not as a sibling strip", () => {
    const { container } = render(<MobileTasksPage />)

    const card = container.querySelector(".task-item")
    expect(card).not.toBeNull()
    expect(card!.contains(effortInput())).toBe(true)
  })

  it("keeps the effort input out of the selection button", () => {
    render(<MobileTasksPage />)

    expect(effortInput().closest("button")).toBeNull()
  })

  it("does not toggle selection when the effort input is clicked", () => {
    render(<MobileTasksPage />)

    fireEvent.click(effortInput())

    expect(screen.queryByText("Facturer")).not.toBeInTheDocument()
  })

  it("still toggles selection from the card hit area", () => {
    const { container } = render(<MobileTasksPage />)

    fireEvent.click(container.querySelector(".task-item-hit")!)

    expect(screen.getByText("Facturer")).toBeInTheDocument()
  })

  it("commits the captured effort on blur", () => {
    render(<MobileTasksPage />)

    fireEvent.change(effortInput(), { target: { value: "1,5" } })
    fireEvent.blur(effortInput())

    expect(updateEffortMock).toHaveBeenCalledWith({
      id: "task-1",
      actualDays: 1.5,
    })
  })

  it("disables the effort input on an already invoiced task", () => {
    mockTasks([buildTask({ invoiceId: "inv-1", actualDays: 3 })])

    render(<MobileTasksPage />)

    expect(effortInput()).toBeDisabled()
  })

  it("keeps the Linear deep link on the task identifier", () => {
    render(<MobileTasksPage />)

    expect(screen.getByText("TRI-1").closest("a")).toHaveAttribute(
      "href",
      "https://linear.app/x/issue/TRI-1",
    )
  })
})

function normalize(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim()
}

function selectFirstCard(container: HTMLElement) {
  fireEvent.click(container.querySelector(".task-item-hit")!)
}

describe("MobileTasksPage billability", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useTaskCountsMock.mockReset()
    bulkBillabilityMock.mockReset()
    mockTasks([buildTask()])
  })

  it("bulk marking opens the dialog and calls the bulk hook with ids and reason", () => {
    const { container } = render(<MobileTasksPage />)
    selectFirstCard(container)

    fireEvent.click(screen.getByRole("button", { name: "Non facturable" }))
    expect(
      screen.getByRole("dialog", {
        name: "Marquer 1 tâche comme non facturable",
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("radio", { name: "Bug déjà facturé" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))

    expect(bulkBillabilityMock).toHaveBeenCalledWith(
      {
        taskIds: ["task-1"],
        billable: false,
        nonBillableReason: "BUG_FIX_ALREADY_INVOICED",
        nonBillableNote: null,
      },
      expect.anything(),
    )
  })

  it("keeps confirm disabled for OTHER until a note is provided", () => {
    const { container } = render(<MobileTasksPage />)
    selectFirstCard(container)
    fireEvent.click(screen.getByRole("button", { name: "Non facturable" }))
    fireEvent.click(screen.getByRole("radio", { name: "Autre" }))

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeDisabled()
    expect(
      screen.getByText("Une note est requise pour la raison « Autre »."),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Note/), {
      target: { value: "Geste offert" },
    })

    expect(screen.getByRole("button", { name: "Confirmer" })).toBeEnabled()
  })

  it("renders a non-billable card muted with its reason pill and a 0 € value", () => {
    mockTasks([
      buildTask({
        billable: false,
        nonBillableReason: "COMMERCIAL_GESTURE",
      }),
    ])

    const { container } = render(<MobileTasksPage />)

    const card = container.querySelector(".task-item")
    expect(card).not.toBeNull()
    expect(card).toHaveStyle({ opacity: "0.7" })
    expect(screen.getByText("Geste commercial")).toBeInTheDocument()

    const meta = container.querySelector(".task-meta")
    expect(normalize(meta?.textContent)).toContain("0 €")
  })

  it("filters to non-billable tasks via the Non facturable chip with its count", () => {
    mockTasks([
      buildTask({ title: "Task facturable" }),
      buildTask({
        id: "task-2",
        linearIdentifier: "TRI-2",
        title: "Task offerte",
        billable: false,
        nonBillableReason: "NON_BILLED_WORK",
      }),
    ])

    render(<MobileTasksPage />)

    fireEvent.click(screen.getByRole("button", { name: /Non facturable\s*1/ }))

    expect(screen.getByText("Task offerte")).toBeInTheDocument()
    expect(screen.queryByText("Task facturable")).not.toBeInTheDocument()
  })

  it("surfaces the count of billable pending tasks without estimate", () => {
    mockTasks([
      buildTask({ estimate: null }),
      buildTask({
        id: "task-2",
        linearIdentifier: "TRI-2",
        estimate: null,
        billable: false,
        nonBillableReason: "NON_BILLED_WORK",
      }),
    ])

    render(<MobileTasksPage />)

    expect(
      screen.getByText(/1 tâche à facturer sans estimation/),
    ).toBeInTheDocument()
  })

  it("restores an all-non-billable selection without any dialog", () => {
    mockTasks([
      buildTask({
        billable: false,
        nonBillableReason: "COMMERCIAL_GESTURE",
      }),
    ])

    const { container } = render(<MobileTasksPage />)
    selectFirstCard(container)

    expect(screen.queryByText("Facturer")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Facturable" }))

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
})

describe("MobileTasksPage default scope", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    useTaskCountsMock.mockReset()
  })

  it("defaults the filter to À facturer and hides other statuses", () => {
    mockTasks([
      buildTask(),
      buildTask({
        id: "task-2",
        linearIdentifier: "TRI-2",
        title: "Task done",
        status: "DONE",
      }),
    ])

    render(<MobileTasksPage />)

    expect(screen.getByRole("button", { name: /^À facturer/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()
    expect(screen.queryByText("Task done")).not.toBeInTheDocument()
  })

  it("explains the default status scope instead of blaming filters nobody set", () => {
    mockTasks([buildTask({ status: "BACKLOG" })])

    render(<MobileTasksPage />)

    expect(screen.getByText("Aucune task à facturer")).toBeInTheDocument()
    expect(screen.queryByText("Aucune task")).not.toBeInTheDocument()
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Voir toutes les tasks" }),
    )

    expect(screen.getByText("Aucune task active")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Toutes tes tasks sont en backlog ou annulées, elles ne sont pas affichées ici",
      ),
    ).toBeInTheDocument()
  })

  it("offers a one-tap reset back to the default filter from an empty scope", () => {
    mockTasks([buildTask()])

    render(<MobileTasksPage />)

    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser le filtre" }),
    )
    expect(screen.getByText("Implementer le dashboard")).toBeInTheDocument()
  })
})
