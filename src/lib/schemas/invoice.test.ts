import { describe, expect, it } from "vitest"
import { invoiceCreateSchema } from "./invoice"

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    clientId: "client-1",
    status: "DRAFT",
    kind: "STANDARD",
    issueDate: "2026-08-04",
    dueDate: "2026-09-04",
    lines: [{ taskId: "task-1", label: "Images", qty: 1, rate: 500 }],
    ...overrides,
  }
}

describe("invoice task groups schema", () => {
  it("accepts ad-hoc groups referenced by invoice lines", () => {
    const result = invoiceCreateSchema.safeParse(
      invoice({
        taskGroupIds: ["bucket-cdn"],
        lines: [
          {
            taskId: "task-1",
            taskGroupId: "bucket-cdn",
            label: "Images",
            qty: 1,
            rate: 500,
          },
          {
            taskId: "task-2",
            taskGroupId: "bucket-cdn",
            label: "CDN",
            qty: 1,
            rate: 300,
          },
          { taskId: "task-3", label: "Audit", qty: 1, rate: 200 },
        ],
      }),
    )

    expect(result.success).toBe(true)
  })

  it("rejects a line referencing an unknown group", () => {
    const result = invoiceCreateSchema.safeParse(
      invoice({
        taskGroupIds: [],
        lines: [
          {
            taskId: "task-1",
            taskGroupId: "missing",
            label: "Images",
            qty: 1,
            rate: 500,
          },
        ],
      }),
    )

    expect(result.success).toBe(false)
  })

  it("rejects duplicate group ids", () => {
    const result = invoiceCreateSchema.safeParse(
      invoice({
        taskGroupIds: ["same", "same"],
        lines: [
          {
            taskId: "task-1",
            taskGroupId: "same",
            label: "Images",
            qty: 1,
            rate: 500,
          },
        ],
      }),
    )

    expect(result.success).toBe(false)
  })

  it("rejects groups on deposit invoices", () => {
    const result = invoiceCreateSchema.safeParse(
      invoice({
        kind: "DEPOSIT",
        taskGroupIds: ["g1"],
        lines: [
          {
            taskGroupId: "g1",
            label: "Acompte",
            qty: 1,
            rate: 500,
          },
        ],
      }),
    )

    expect(result.success).toBe(false)
  })
})
