import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { MobileTasksPage } from "./mobile"
import type { TaskDTO } from "@/hooks/use-tasks"

const { useTasksMock, updateEffortMock } = vi.hoisted(() => ({
  useTasksMock: vi.fn(),
  updateEffortMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => useTasksMock(),
  useSyncLinear: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTaskEffort: () => ({ mutate: updateEffortMock, isPending: false }),
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
    ...overrides,
  }
}

function effortInput() {
  return screen.getByLabelText("Temps réel passé, en jours")
}

describe("MobileTasksPage effort capture", () => {
  beforeEach(() => {
    useTasksMock.mockReset()
    updateEffortMock.mockReset()
    useTasksMock.mockReturnValue({ data: [buildTask()] })
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
    useTasksMock.mockReturnValue({
      data: [buildTask({ invoiceId: "inv-1", actualDays: 3 })],
    })

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
