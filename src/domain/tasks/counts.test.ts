import { describe, expect, it } from "vitest"
import {
  buildTaskCountsSummary,
  taskCountsQuerySchema,
  taskIdListParamSchema,
  TASK_ID_FILTER_MAX,
} from "./counts"

describe("taskIdListParamSchema", () => {
  it("decodes a comma-separated list into a string array", () => {
    expect(taskIdListParamSchema.parse("c1,c2")).toEqual(["c1", "c2"])
  })

  it("decodes a single value as a one-element list", () => {
    expect(taskIdListParamSchema.parse("c1")).toEqual(["c1"])
  })

  it("decodes an empty param to an empty list, meaning no narrowing", () => {
    expect(taskIdListParamSchema.parse("")).toEqual([])
  })

  it("drops blank segments instead of producing empty ids", () => {
    expect(taskIdListParamSchema.parse("c1,, c2 ,")).toEqual(["c1", "c2"])
  })

  it("rejects a list longer than the cap", () => {
    const oversized = Array.from(
      { length: TASK_ID_FILTER_MAX + 1 },
      (_, i) => `c${i}`,
    ).join(",")

    expect(() => taskIdListParamSchema.parse(oversized)).toThrow()
  })

  it("accepts a list exactly at the cap", () => {
    const atCap = Array.from(
      { length: TASK_ID_FILTER_MAX },
      (_, i) => `c${i}`,
    ).join(",")

    expect(taskIdListParamSchema.parse(atCap)).toHaveLength(TASK_ID_FILTER_MAX)
  })
})

describe("taskCountsQuerySchema", () => {
  it("accepts the status summary mode with no narrowing", () => {
    const parsed = taskCountsQuerySchema.parse({ summary: "status" })

    expect(parsed).toEqual({ summary: "status" })
  })

  it("decodes clientIds and projectIds multi-select narrowing", () => {
    const parsed = taskCountsQuerySchema.parse({
      summary: "status",
      clientIds: "c1,c2",
      projectIds: "p1",
    })

    expect(parsed.clientIds).toEqual(["c1", "c2"])
    expect(parsed.projectIds).toEqual(["p1"])
  })

  it("rejects an unknown summary mode", () => {
    expect(() =>
      taskCountsQuerySchema.parse({ summary: "everything" }),
    ).toThrow()
  })

  it("rejects an oversized clientIds list", () => {
    const oversized = Array.from(
      { length: TASK_ID_FILTER_MAX + 1 },
      (_, i) => `c${i}`,
    ).join(",")

    expect(() =>
      taskCountsQuerySchema.parse({ summary: "status", clientIds: oversized }),
    ).toThrow()
  })
})

describe("buildTaskCountsSummary", () => {
  it("maps the aggregate row onto the filter-id keys of both page twins", () => {
    const summary = buildTaskCountsSummary({
      all: 137,
      pending: 80,
      done: 40,
      inProgress: 17,
      invoiced: 61,
      nonBillable: 9,
      unestimated: 52,
    })

    expect(summary).toEqual({
      all: 137,
      pending: 80,
      done: 40,
      in_progress: 17,
      invoiced: 61,
      non_billable: 9,
      unestimatedCount: 52,
    })
  })

  it("preserves totals far beyond one 50-row page", () => {
    const summary = buildTaskCountsSummary({
      all: 4_812,
      pending: 1_204,
      done: 3_591,
      inProgress: 17,
      invoiced: 3_400,
      nonBillable: 210,
      unestimated: 951,
    })

    expect(summary.all).toBe(4_812)
    expect(summary.pending).toBe(1_204)
    expect(summary.done).toBe(3_591)
    expect(summary.invoiced).toBe(3_400)
    expect(summary.unestimatedCount).toBe(951)
  })

  it("coerces bigint counts coming back from the driver", () => {
    const summary = buildTaskCountsSummary({
      all: BigInt(137),
      pending: BigInt(80),
      done: BigInt(40),
      inProgress: BigInt(17),
      invoiced: BigInt(61),
      nonBillable: BigInt(9),
      unestimated: BigInt(52),
    })

    expect(summary.all).toBe(137)
    expect(summary.non_billable).toBe(9)
    expect(summary.unestimatedCount).toBe(52)
  })

  it("returns all-zero counts when the driver returned no row", () => {
    expect(buildTaskCountsSummary(undefined)).toEqual({
      all: 0,
      pending: 0,
      done: 0,
      in_progress: 0,
      invoiced: 0,
      non_billable: 0,
      unestimatedCount: 0,
    })
  })
})
