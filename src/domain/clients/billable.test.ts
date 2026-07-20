import { describe, expect, it } from "vitest"
import { buildClientsBillableSummary, type BillableGroupRow } from "./billable"

function group(overrides: Partial<BillableGroupRow> = {}): BillableGroupRow {
  return {
    clientId: "client-1",
    billingMode: "DAILY",
    rate: 500,
    taskCount: 1,
    estimateDays: 1,
    ...overrides,
  }
}

describe("buildClientsBillableSummary", () => {
  it("returns empty totals for no billable task", () => {
    expect(buildClientsBillableSummary([])).toEqual({
      byClient: {},
      totalCount: 0,
      totalValue: 0,
    })
  })

  it("values a DAILY group at estimateDays * rate", () => {
    const summary = buildClientsBillableSummary([
      group({ taskCount: 3, estimateDays: 5 }),
    ])

    expect(summary.byClient["client-1"]).toEqual({ count: 3, value: 2500 })
    expect(summary.totalValue).toBe(2500)
    expect(summary.totalCount).toBe(3)
  })

  it("values an HOURLY group at estimateDays * 8 * rate", () => {
    const summary = buildClientsBillableSummary([
      group({ billingMode: "HOURLY", rate: 80, taskCount: 2, estimateDays: 3 }),
    ])

    expect(summary.byClient["client-1"]).toEqual({ count: 2, value: 1920 })
  })

  it("counts FIXED tasks but values them at zero", () => {
    const summary = buildClientsBillableSummary([
      group({ billingMode: "FIXED", rate: 0, taskCount: 4, estimateDays: 9 }),
    ])

    expect(summary.byClient["client-1"]).toEqual({ count: 4, value: 0 })
    expect(summary.totalCount).toBe(4)
    expect(summary.totalValue).toBe(0)
  })

  it("keeps the count global while FIXED clients contribute no euro", () => {
    const summary = buildClientsBillableSummary([
      group({ clientId: "a", taskCount: 2, estimateDays: 2 }),
      group({
        clientId: "b",
        billingMode: "FIXED",
        rate: 0,
        taskCount: 7,
        estimateDays: 12,
      }),
    ])

    expect(summary.totalCount).toBe(9)
    expect(summary.totalValue).toBe(1000)
  })

  it("aggregates far beyond one page of tasks", () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      group({ clientId: `client-${i}`, taskCount: 3, estimateDays: 2 }),
    )

    const summary = buildClientsBillableSummary(rows)

    expect(summary.totalCount).toBe(180)
    expect(summary.totalValue).toBe(60 * 1000)
    expect(summary.byClient["client-57"]).toEqual({ count: 3, value: 1000 })
  })

  it("folds duplicate rows for the same client", () => {
    const summary = buildClientsBillableSummary([
      group({ clientId: "a", taskCount: 1, estimateDays: 1 }),
      group({ clientId: "a", taskCount: 2, estimateDays: 3 }),
    ])

    expect(summary.byClient["a"]).toEqual({ count: 3, value: 2000 })
  })
})
