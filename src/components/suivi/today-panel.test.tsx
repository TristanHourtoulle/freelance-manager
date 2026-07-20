import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const actions = vi.fn<() => { data: unknown[] }>()
const meetings = vi.fn<() => { data: unknown[] }>()
const dashboard = vi.fn<() => { data: unknown }>()

vi.mock("@/hooks/use-actions", () => ({
  useActions: () => actions(),
  useUpdateAction: () => ({ mutate: vi.fn(), isPending: false }),
  useRelanceInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-meetings", () => ({
  useMeetings: () => meetings(),
}))

vi.mock("@/hooks/use-dashboard", () => ({
  useDashboard: () => dashboard(),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { TodayPanel } from "./today-panel"

interface DashboardStub {
  pipelineCount?: number
  overdue?: {
    id: string
    number: string
    clientId: string
    total: number
    dueDate: string
  }[]
  inProgressCount?: number
  inProgressTop?: {
    id: string
    linearIdentifier: string
    linearUrl: string | null
    title: string
    projectKey: string | null
  }[]
}

function setup({
  actionRows = [] as unknown[],
  meetingRows = [] as unknown[],
  stub = {} as DashboardStub,
} = {}) {
  actions.mockReturnValue({ data: actionRows })
  meetings.mockReturnValue({ data: meetingRows })
  dashboard.mockReturnValue({
    data: {
      kpi: { pipelineCount: stub.pipelineCount ?? 0 },
      overdue: stub.overdue ?? [],
      inProgress: {
        count: stub.inProgressCount ?? 0,
        top: stub.inProgressTop ?? [],
      },
    },
  })
  return render(<TodayPanel />)
}

function dueAction(id: string, client: unknown = null) {
  return {
    id,
    clientId: null,
    client,
    type: "OTHER",
    title: `Action ${id}`,
    link: null,
    notes: null,
    status: "TODO",
    dueDate: new Date().toISOString(),
    doneAt: null,
    invoiceId: null,
    invoiceNumber: null,
    meetingId: null,
    createdAt: new Date().toISOString(),
  }
}

afterEach(() => {
  actions.mockReset()
  meetings.mockReset()
  dashboard.mockReset()
})

describe("TodayPanel", () => {
  it("still renders with nothing scheduled", () => {
    setup()
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument()
    expect(screen.getByText("Rien pour aujourd'hui")).toBeInTheDocument()
  })

  it("points at the pipeline in the empty state", () => {
    setup({ stub: { pipelineCount: 4 } })
    expect(
      screen.getByText("4 tasks en attente de facturation"),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Facturer" })).toBeInTheDocument()
  })

  it("says everything is up to date when the pipeline is empty", () => {
    setup({ stub: { pipelineCount: 0 } })
    expect(screen.getByText("Tout est à jour.")).toBeInTheDocument()
  })

  it("renders an unclassified action without throwing", () => {
    setup({ actionRows: [dueAction("a1")] })
    expect(screen.getByText("Action a1")).toBeInTheDocument()
    expect(screen.getByText("Non classé")).toBeInTheDocument()
  })

  it("caps the action list at three rows", () => {
    setup({
      actionRows: ["a1", "a2", "a3", "a4", "a5"].map((id) => dueAction(id)),
    })
    expect(
      screen.getAllByRole("button", { name: "Marquer fait" }),
    ).toHaveLength(3)
  })

  it("offers a relance on an overdue invoice", () => {
    setup({
      stub: {
        overdue: [
          {
            id: "inv1",
            number: "2026-1001",
            clientId: "c1",
            total: 1200,
            dueDate: new Date(2020, 0, 1).toISOString(),
          },
        ],
      },
    })
    expect(screen.getByRole("button", { name: /Relancer/ })).toBeInTheDocument()
  })

  it("shows the total in-progress count when more than three exist", () => {
    setup({
      stub: {
        inProgressCount: 7,
        inProgressTop: [
          {
            id: "t1",
            linearIdentifier: "TRI-1",
            linearUrl: null,
            title: "Refactor",
            projectKey: "TRI",
          },
        ],
      },
    })
    expect(screen.getByText("En cours · 7")).toBeInTheDocument()
  })
})
