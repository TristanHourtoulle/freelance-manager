import { describe, expect, it } from "vitest"
import { buildTaskCountsSummary, taskCountsQuerySchema } from "./counts"

describe("taskCountsQuerySchema", () => {
  it("accepts the status summary mode with no narrowing", () => {
    const parsed = taskCountsQuerySchema.parse({ summary: "status" })

    expect(parsed).toEqual({ summary: "status" })
  })

  it("accepts clientId and projectId narrowing", () => {
    const parsed = taskCountsQuerySchema.parse({
      summary: "status",
      clientId: "c1",
      projectId: "p1",
    })

    expect(parsed.clientId).toBe("c1")
    expect(parsed.projectId).toBe("p1")
  })

  it("rejects an unknown summary mode", () => {
    expect(() =>
      taskCountsQuerySchema.parse({ summary: "everything" }),
    ).toThrow()
  })

  it("rejects an empty clientId", () => {
    expect(() =>
      taskCountsQuerySchema.parse({ summary: "status", clientId: "" }),
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
