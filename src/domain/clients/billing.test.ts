import { describe, it, expect } from "vitest"
import {
  deriveClientBilling,
  type BillableTaskRow,
  type ClientBillingInput,
} from "./billing"

interface Task extends BillableTaskRow {
  id: string
  linearIdentifier: string
  linearUrl: string | null
  title: string
  projectId: string
}

type BillingInput = ClientBillingInput<Task>

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

function client(overrides: Partial<BillingInput> = {}): BillingInput {
  return {
    billingMode: "DAILY",
    rate: 500,
    archivedAt: null,
    category: "FREELANCE",
    tasks: [],
    ...overrides,
  }
}

describe("deriveClientBilling", () => {
  it("counts only billable PENDING_INVOICE tasks not yet invoiced", () => {
    const { billableTasks } = deriveClientBilling(
      client({
        tasks: [
          task({ id: "a", status: "PENDING_INVOICE", invoiceId: null }),
          task({ id: "b", status: "PENDING_INVOICE", invoiceId: "inv1" }),
          task({ id: "c", status: "DONE", invoiceId: null }),
          task({ id: "d", status: "BACKLOG", invoiceId: null }),
          task({ id: "e", billable: false }),
        ],
      }),
    )

    expect(billableTasks.map((t) => t.id)).toEqual(["a"])
  })

  it("sums the DAILY pipeline value over billable tasks", () => {
    const { pipelineValue } = deriveClientBilling(
      client({
        tasks: [
          task({ id: "a", estimate: 2 }),
          task({ id: "b", estimate: 3 }),
          task({ id: "c", estimate: 4, invoiceId: "inv1" }),
        ],
      }),
    )

    expect(pipelineValue).toBe(2500)
  })

  it("values HOURLY tasks at estimate * 8 * rate", () => {
    const { pipelineValue } = deriveClientBilling(
      client({
        billingMode: "HOURLY",
        rate: 80,
        tasks: [task({ id: "a", estimate: 1 })],
      }),
    )

    expect(pipelineValue).toBe(640)
  })

  it("excludes FIXED clients from the pipeline value", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling(
      client({
        billingMode: "FIXED",
        rate: 0,
        tasks: [task({ id: "a", estimate: 5 })],
      }),
    )

    expect(billableTasks.map((t) => t.id)).toEqual(["a"])
    expect(pipelineValue).toBe(0)
  })

  it("values unestimated tasks at zero while keeping them billable", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling(
      client({
        tasks: [
          task({ id: "a", estimate: 2 }),
          task({ id: "b", estimate: null }),
        ],
      }),
    )

    expect(billableTasks.map((t) => t.id)).toEqual(["a", "b"])
    expect(pipelineValue).toBe(1000)
  })

  it("excludes every task of an archived client", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling(
      client({
        archivedAt: "2026-01-01T00:00:00.000Z",
        tasks: [task({ id: "a", estimate: 2 })],
      }),
    )

    expect(billableTasks).toHaveLength(0)
    expect(pipelineValue).toBe(0)
  })

  it("excludes every task of a non-freelance client", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling(
      client({
        category: "PERSONAL",
        tasks: [task({ id: "a", estimate: 2 })],
      }),
    )

    expect(billableTasks).toHaveLength(0)
    expect(pipelineValue).toBe(0)
  })

  it("returns zero pipeline for a client with no billable tasks", () => {
    const { billableTasks, pipelineValue } = deriveClientBilling(
      client({ tasks: [task({ id: "a", status: "DONE" })] }),
    )

    expect(billableTasks).toHaveLength(0)
    expect(pipelineValue).toBe(0)
  })
})
