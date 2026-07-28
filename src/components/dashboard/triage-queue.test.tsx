import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const actions = vi.fn<() => { data: unknown[] }>()
const meetings = vi.fn<() => { data: unknown[] }>()

vi.mock("@/hooks/use-actions", () => ({
  useActions: () => actions(),
  useUpdateAction: () => ({ mutate: vi.fn(), isPending: false }),
  useRelanceInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-meetings", () => ({
  useMeetings: () => meetings(),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { TriageQueue } from "./triage-queue"

interface SetupInput {
  actionRows?: unknown[]
  meetingRows?: unknown[]
  overdue?: {
    id: string
    number: string
    clientId: string
    total: number
    dueDate: string
  }[]
  pipelineAging?: {
    oldestDays: number | null
    staleCount: number
    staleValue: number
  }
  unestimatedCount?: number
  pipelineCount?: number
}

function setup({
  actionRows = [],
  meetingRows = [],
  overdue = [],
  pipelineAging = { oldestDays: null, staleCount: 0, staleValue: 0 },
  unestimatedCount = 0,
  pipelineCount = 0,
}: SetupInput = {}) {
  actions.mockReturnValue({ data: actionRows })
  meetings.mockReturnValue({ data: meetingRows })
  return render(
    <TriageQueue
      overdue={overdue}
      pipelineAging={pipelineAging}
      unestimatedCount={unestimatedCount}
      pipelineCount={pipelineCount}
    />,
  )
}

function dueAction(id: string) {
  return {
    id,
    title: `Action ${id}`,
    status: "TODO",
    dueDate: new Date().toISOString(),
  }
}

afterEach(() => {
  actions.mockReset()
  meetings.mockReset()
})

describe("TriageQueue", () => {
  it("still renders with nothing scheduled", () => {
    setup()
    expect(screen.getByText("À traiter aujourd'hui")).toBeInTheDocument()
    expect(screen.getByText("Rien pour aujourd'hui")).toBeInTheDocument()
  })

  it("points at the pipeline in the empty state", () => {
    setup({ pipelineCount: 4 })
    expect(
      screen.getByText("4 tasks en attente de facturation"),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Facturer" })).toBeInTheDocument()
  })

  it("says everything is up to date when the pipeline is empty", () => {
    setup({ pipelineCount: 0 })
    expect(screen.getByText("Tout est à jour.")).toBeInTheDocument()
  })

  it("caps the due-action rows at three", () => {
    setup({
      actionRows: ["a1", "a2", "a3", "a4", "a5"].map((id) => dueAction(id)),
    })
    expect(screen.getAllByRole("button", { name: "Fait" })).toHaveLength(3)
  })

  it("offers a relance on an overdue invoice", () => {
    setup({
      overdue: [
        {
          id: "inv1",
          number: "2026-1001",
          clientId: "c1",
          total: 1200,
          dueDate: new Date(2020, 0, 1).toISOString(),
        },
      ],
    })
    expect(screen.getByText("2026-1001")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Relancer/ })).toBeInTheDocument()
  })

  it("links the unestimated row to the tasks page", () => {
    setup({ unestimatedCount: 2 })
    expect(screen.getByText("2 tâches à estimer")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Estimer" })).toHaveAttribute(
      "href",
      "/tasks",
    )
  })

  it("counts every item in the header pill", () => {
    setup({
      overdue: [
        {
          id: "inv1",
          number: "2026-1001",
          clientId: "c1",
          total: 1200,
          dueDate: new Date(2020, 0, 1).toISOString(),
        },
      ],
      unestimatedCount: 1,
      actionRows: [dueAction("a1")],
    })
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("renders danger rows before plain rows", () => {
    const { container } = setup({
      overdue: [
        {
          id: "inv1",
          number: "2026-1001",
          clientId: "c1",
          total: 1200,
          dueDate: new Date(2020, 0, 1).toISOString(),
        },
      ],
      actionRows: [dueAction("a1")],
    })
    const rows = Array.from(container.querySelectorAll(".triage-row"))
    expect(rows[0]?.className).toContain("triage-danger")
    expect(rows[1]?.className).toContain("triage-plain")
  })
})
