import { describe, it, expect } from "vitest"
import { deriveClientBilling } from "./page"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"

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
    ...overrides,
  }
}

describe("deriveClientBilling", () => {
  it("counts only PENDING_INVOICE tasks not yet invoiced", () => {
    const { billableTasks } = deriveClientBilling({
      billingMode: "DAILY",
      rate: 500,
      tasks: [
        task({ id: "a", status: "PENDING_INVOICE", invoiceId: null }),
        task({ id: "b", status: "PENDING_INVOICE", invoiceId: "inv1" }),
        task({ id: "c", status: "DONE", invoiceId: null }),
        task({ id: "d", status: "BACKLOG", invoiceId: null }),
      ],
    })

    expect(billableTasks.map((t) => t.id)).toEqual(["a"])
  })

  it("sums the DAILY pipeline value over billable tasks", () => {
    const { pipelineValue } = deriveClientBilling({
      billingMode: "DAILY",
      rate: 500,
      tasks: [
        task({ id: "a", estimate: 2 }),
        task({ id: "b", estimate: 3 }),
        task({ id: "c", estimate: 4, invoiceId: "inv1" }),
      ],
    })

    expect(pipelineValue).toBe(2500)
  })

  it("values HOURLY tasks at estimate * 8 * rate", () => {
    const { pipelineValue } = deriveClientBilling({
      billingMode: "HOURLY",
      rate: 80,
      tasks: [task({ id: "a", estimate: 1 })],
    })

    expect(pipelineValue).toBe(640)
  })

  it("excludes FIXED clients from the pipeline value", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling({
      billingMode: "FIXED",
      rate: 0,
      tasks: [task({ id: "a", estimate: 5 })],
    })

    expect(billableTasks.map((t) => t.id)).toEqual(["a"])
    expect(pipelineValue).toBe(0)
  })

  it("returns zero pipeline for a client with no billable tasks", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling({
      billingMode: "DAILY",
      rate: 500,
      tasks: [task({ id: "a", status: "DONE" })],
    })

    expect(billableTasks).toHaveLength(0)
    expect(pipelineValue).toBe(0)
  })
})
