import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { EligibleTaskColumn } from "@/features/billing/invoice-builder-parts"
import type { InvoiceBuilder } from "@/features/billing/invoice-builder-types"
import type { TaskDTO } from "@/hooks/use-tasks"

const task = {
  id: "t1",
  linearIdentifier: "TRI-1",
  title: "Premiere task",
  estimate: 2,
  projectId: "p1",
} as TaskDTO

function makeBuilder(addTask: (t: TaskDTO) => void): InvoiceBuilder {
  return {
    client: { billingMode: "DAILY", rate: 500 },
    eligibleTasks: [task],
    projectById: new Map(),
    taskSearch: "",
    setTaskSearch: vi.fn(),
    useTotalOverride: false,
    addTask,
  } as unknown as InvoiceBuilder
}

describe("EligibleTaskColumn", () => {
  it("renders each eligible task as a real button", () => {
    render(<EligibleTaskColumn builder={makeBuilder(vi.fn())} />)
    const row = screen.getByRole("button", { name: /TRI-1/ })
    expect(row.tagName).toBe("BUTTON")
    expect(row).toHaveAttribute("type", "button")
  })

  it("reaches the task row with the keyboard and activates it with Enter", async () => {
    const user = userEvent.setup()
    const addTask = vi.fn()
    render(<EligibleTaskColumn builder={makeBuilder(addTask)} />)

    await user.tab()
    await user.tab()
    const row = screen.getByRole("button", { name: /TRI-1/ })
    expect(row).toHaveFocus()

    await user.keyboard("{Enter}")
    expect(addTask).toHaveBeenCalledWith(task)
  })

  it("activates the task row with Space", async () => {
    const user = userEvent.setup()
    const addTask = vi.fn()
    render(<EligibleTaskColumn builder={makeBuilder(addTask)} />)

    screen.getByRole("button", { name: /TRI-1/ }).focus()
    await user.keyboard(" ")
    expect(addTask).toHaveBeenCalledWith(task)
  })

  it("keeps the drag affordance for pointer users", () => {
    render(<EligibleTaskColumn builder={makeBuilder(vi.fn())} />)
    expect(screen.getByRole("button", { name: /TRI-1/ })).toHaveAttribute(
      "draggable",
      "true",
    )
  })
})
