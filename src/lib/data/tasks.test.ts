import { beforeEach, describe, expect, it, vi } from "vitest"

const queryRaw = vi.fn()
const findMany = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) =>
      queryRaw(strings, ...values),
    task: { findMany: (...args: unknown[]) => findMany(...args) },
  },
}))

const { getTaskCountsSummary } = await import("./tasks")

function aggregateRow(overrides: Record<string, number | bigint> = {}) {
  return {
    all: 137,
    pending: 80,
    done: 40,
    inProgress: 17,
    invoiced: 61,
    nonBillable: 9,
    unestimated: 52,
    ...overrides,
  }
}

function firstCall() {
  return queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
}

describe("getTaskCountsSummary", () => {
  beforeEach(() => {
    queryRaw.mockReset()
    findMany.mockReset()
    queryRaw.mockResolvedValue([aggregateRow()])
  })

  it("counts in the database instead of fetching rows, in a single round trip", async () => {
    await getTaskCountsSummary("user-1")

    const [strings] = firstCall()
    const sql = strings.join("?")
    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(findMany).not.toHaveBeenCalled()
    expect(sql).toContain("COUNT(*) FILTER")
    expect(sql).not.toContain("LIMIT")
    expect(sql).not.toContain("SELECT t.*")
  })

  it("reports true totals far beyond the 50-row page size", async () => {
    queryRaw.mockResolvedValue([
      aggregateRow({ all: 4_812, pending: 1_204, unestimated: 951 }),
    ])

    const summary = await getTaskCountsSummary("user-1")

    expect(summary.all).toBe(4_812)
    expect(summary.pending).toBe(1_204)
    expect(summary.unestimatedCount).toBe(951)
  })

  it("scopes every count to the owning user", async () => {
    await getTaskCountsSummary("user-1")

    const [strings, ...values] = firstCall()
    expect(strings.join("?")).toContain('t."userId" = ')
    expect(values[0]).toBe("user-1")
  })

  it("restricts the universe to the statuses visible on the Tasks page", async () => {
    await getTaskCountsSummary("user-1")

    const [strings] = firstCall()
    const sql = strings.join("?")
    expect(sql).toContain(
      "IN ('PENDING_INVOICE', 'DONE', 'IN_PROGRESS', 'BACKLOG')",
    )
    expect(sql).not.toContain("CANCELED")
  })

  it("passes null narrowing parameters when no filter is active", async () => {
    await getTaskCountsSummary("user-1")

    const [, ...values] = firstCall()
    expect(values).toEqual(["user-1", null, null, null, null])
  })

  it("forwards the clientId and projectId filters as parameters", async () => {
    await getTaskCountsSummary("user-1", { clientId: "c1", projectId: "p1" })

    const [strings, ...values] = firstCall()
    const sql = strings.join("?")
    expect(values).toEqual(["user-1", "c1", "c1", "p1", "p1"])
    expect(sql).toContain('t."clientId" = ')
    expect(sql).toContain('t."projectId" = ')
  })

  it("computes the unestimated figure with the billable pending-uninvoiced gate", async () => {
    await getTaskCountsSummary("user-1")

    const [strings] = firstCall()
    const sql = strings.join("?").replace(/\s+/g, " ")
    expect(sql).toContain(
      `t."status" = 'PENDING_INVOICE' AND t."billable" = true AND t."invoiceId" IS NULL AND t."estimate" IS NULL`,
    )
  })

  it("counts every PENDING_INVOICE row for pending, not the pipeline gate", async () => {
    await getTaskCountsSummary("user-1")

    const [strings] = firstCall()
    const sql = strings.join("?")
    expect(sql).not.toContain("FREELANCE")
    expect(sql).not.toContain("archivedAt")
  })

  it("returns all-zero counts when the driver yields no row", async () => {
    queryRaw.mockResolvedValue([])

    const summary = await getTaskCountsSummary("user-1")

    expect(summary).toEqual({
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
