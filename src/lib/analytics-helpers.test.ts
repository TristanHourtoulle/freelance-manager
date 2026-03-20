import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/linear-service", () => ({
  fetchLinearIssues: vi.fn(),
}))

vi.mock("@/lib/billing", () => ({
  calculateBilling: vi.fn(),
}))

import { fetchLinearIssues } from "@/lib/linear-service"
import { calculateBilling } from "@/lib/billing"

import {
  getMonthKey,
  getMonthLabel,
  getFullMonthLabel,
  buildMonthRange,
  computeDateRange,
  buildUtilizationByMonth,
  computeGroupAmount,
  fetchIssueMapForClient,
} from "./analytics-helpers"

import type { OverrideWithClient } from "./analytics-helpers"
import type { Client } from "@/generated/prisma/client"

// ---------------------------------------------------------------------------
// getMonthKey
// ---------------------------------------------------------------------------
describe("getMonthKey", () => {
  it("returns YYYY-MM for a given date", () => {
    expect(getMonthKey(new Date("2026-03-15"))).toBe("2026-03")
  })

  it("pads single-digit months with a leading zero", () => {
    expect(getMonthKey(new Date("2026-01-01"))).toBe("2026-01")
  })

  it("handles December correctly", () => {
    expect(getMonthKey(new Date("2025-12-31"))).toBe("2025-12")
  })

  it("handles first day of the year", () => {
    expect(getMonthKey(new Date("2026-01-01"))).toBe("2026-01")
  })
})

// ---------------------------------------------------------------------------
// getMonthLabel
// ---------------------------------------------------------------------------
describe("getMonthLabel", () => {
  it("returns abbreviated label for January", () => {
    expect(getMonthLabel("2026-01")).toBe("Jan")
  })

  it("returns abbreviated label for December", () => {
    expect(getMonthLabel("2025-12")).toBe("Dec")
  })

  it("returns abbreviated label for June", () => {
    expect(getMonthLabel("2026-06")).toBe("Jun")
  })
})

// ---------------------------------------------------------------------------
// getFullMonthLabel
// ---------------------------------------------------------------------------
describe("getFullMonthLabel", () => {
  it("returns full label with year", () => {
    expect(getFullMonthLabel("2026-03")).toBe("March 2026")
  })

  it("returns January with year", () => {
    expect(getFullMonthLabel("2026-01")).toBe("January 2026")
  })

  it("returns December with year", () => {
    expect(getFullMonthLabel("2025-12")).toBe("December 2025")
  })
})

// ---------------------------------------------------------------------------
// buildMonthRange
// ---------------------------------------------------------------------------
describe("buildMonthRange", () => {
  it("returns a single entry when from and to are in the same month", () => {
    const result = buildMonthRange(
      new Date("2026-03-01"),
      new Date("2026-03-31"),
    )
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ month: "2026-03", label: "Mar", amount: 0 })
  })

  it("returns correct range spanning multiple months", () => {
    const result = buildMonthRange(
      new Date("2026-01-15"),
      new Date("2026-03-10"),
    )
    expect(result).toHaveLength(3)
    expect(result[0]!.month).toBe("2026-01")
    expect(result[1]!.month).toBe("2026-02")
    expect(result[2]!.month).toBe("2026-03")
  })

  it("initializes all amounts to 0", () => {
    const result = buildMonthRange(
      new Date("2026-01-01"),
      new Date("2026-06-01"),
    )
    for (const entry of result) {
      expect(entry.amount).toBe(0)
    }
  })

  it("spans across year boundary", () => {
    const result = buildMonthRange(
      new Date("2025-11-01"),
      new Date("2026-02-01"),
    )
    expect(result).toHaveLength(4)
    expect(result[0]!.month).toBe("2025-11")
    expect(result[3]!.month).toBe("2026-02")
  })

  it("returns empty when from is after to", () => {
    const result = buildMonthRange(
      new Date("2026-06-01"),
      new Date("2026-01-01"),
    )
    expect(result).toHaveLength(0)
  })

  it("includes correct labels", () => {
    const result = buildMonthRange(
      new Date("2026-01-01"),
      new Date("2026-03-01"),
    )
    expect(result.map((r) => r.label)).toEqual(["Jan", "Feb", "Mar"])
  })
})

// ---------------------------------------------------------------------------
// computeDateRange
// ---------------------------------------------------------------------------
describe("computeDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-20T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns current month for '1m'", () => {
    const { from, to } = computeDateRange("1m", null, null)
    expect(from).toEqual(new Date(2026, 2, 1)) // March 1
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(2) // March
  })

  it("returns 6-month range for '6m'", () => {
    const { from } = computeDateRange("6m", null, null)
    // March - 5 = October of previous year
    expect(from).toEqual(new Date(2025, 9, 1)) // October 2025
  })

  it("returns year-to-date for '1y'", () => {
    const { from } = computeDateRange("1y", null, null)
    expect(from).toEqual(new Date(2026, 0, 1)) // January 1
  })

  it("returns 3-month range for default/unknown period", () => {
    const { from } = computeDateRange("unknown", null, null)
    expect(from).toEqual(new Date(2026, 0, 1)) // January 1 (March - 2)
  })

  it("returns 3-month range for '3m' (default)", () => {
    const { from } = computeDateRange("3m", null, null)
    expect(from).toEqual(new Date(2026, 0, 1))
  })

  it("uses custom dates when period is 'custom'", () => {
    const { from, to } = computeDateRange("custom", "2025-06-01", "2025-12-31")
    expect(from).toEqual(new Date("2025-06-01"))
    expect(to).toEqual(new Date("2025-12-31"))
  })

  it("falls back to 3m when custom dates are invalid", () => {
    const { from } = computeDateRange("custom", "not-a-date", "also-bad")
    expect(from).toEqual(new Date(2026, 0, 1))
  })

  it("falls back to defaults when custom params are null", () => {
    const { from, to } = computeDateRange("custom", null, null)
    expect(from).toEqual(new Date(2026, 0, 1))
    expect(to.getMonth()).toBe(2)
  })

  it("falls back when only fromParam is invalid", () => {
    const { from } = computeDateRange("custom", "invalid", "2026-01-01")
    // Both must be valid, otherwise fallback
    expect(from).toEqual(new Date(2026, 0, 1))
  })
})

// ---------------------------------------------------------------------------
// buildUtilizationByMonth
// ---------------------------------------------------------------------------
describe("buildUtilizationByMonth", () => {
  const monthRange = [
    { month: "2026-01", label: "Jan" },
    { month: "2026-02", label: "Feb" },
    { month: "2026-03", label: "Mar" },
  ]

  it("returns 0% rate when no hours are billed", () => {
    const result = buildUtilizationByMonth(monthRange, new Map(), 140)

    expect(result).toHaveLength(3)
    for (const entry of result) {
      expect(entry.billedHours).toBe(0)
      expect(entry.availableHours).toBe(140)
      expect(entry.rate).toBe(0)
    }
  })

  it("calculates correct utilization rates", () => {
    const monthHours = new Map([
      ["2026-01", 112],
      ["2026-02", 70],
      ["2026-03", 140],
    ])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.billedHours).toBe(112)
    expect(result[0]!.rate).toBe(80)
    expect(result[1]!.billedHours).toBe(70)
    expect(result[1]!.rate).toBe(50)
    expect(result[2]!.billedHours).toBe(140)
    expect(result[2]!.rate).toBe(100)
  })

  it("handles utilization above 100%", () => {
    const monthHours = new Map([["2026-01", 168]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.rate).toBe(120)
    expect(result[0]!.billedHours).toBe(168)
  })

  it("handles 0 available hours without crashing", () => {
    const monthHours = new Map([["2026-01", 50]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 0)

    expect(result[0]!.rate).toBe(0)
    expect(result[0]!.billedHours).toBe(50)
  })

  it("rounds billed hours to 2 decimal places", () => {
    const monthHours = new Map([["2026-01", 33.333]])

    const result = buildUtilizationByMonth(monthRange, monthHours, 140)

    expect(result[0]!.billedHours).toBe(33.33)
  })

  it("preserves month labels from input", () => {
    const result = buildUtilizationByMonth(monthRange, new Map(), 140)

    expect(result[0]!.month).toBe("2026-01")
    expect(result[0]!.label).toBe("Jan")
    expect(result[2]!.month).toBe("2026-03")
    expect(result[2]!.label).toBe("Mar")
  })
})

// ---------------------------------------------------------------------------
// computeGroupAmount
// ---------------------------------------------------------------------------
describe("computeGroupAmount", () => {
  const mockedCalculateBilling = vi.mocked(calculateBilling)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  function makeClient(overrides: Record<string, unknown> = {}): Client {
    return {
      id: "client-1",
      name: "Test Client",
      billingMode: "HOURLY",
      rate: 100,
      email: null,
      company: null,
      logo: null,
      category: "FREELANCE",
      notes: null,
      archivedAt: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as unknown as Client
  }

  function makeOverride(
    linearIssueId: string,
    rateOverride: number | null = null,
  ): OverrideWithClient {
    return {
      id: "override-1",
      linearIssueId,
      clientId: "client-1",
      toInvoice: true,
      invoiced: true,
      invoicedAt: new Date(),
      rateOverride,
      createdAt: new Date(),
      updatedAt: new Date(),
      client: {
        ...makeClient(),
        linearMappings: [],
      },
    } as unknown as OverrideWithClient
  }

  it("returns rate as amount for FIXED billing when overrides exist", () => {
    const client = makeClient({ billingMode: "FIXED" as never })
    const overrides = [makeOverride("issue-1")]
    const issueMap = new Map<string, { estimate: number | undefined }>()

    const result = computeGroupAmount(overrides, issueMap, client)

    expect(result.amount).toBe(100)
    expect(result.hours).toBe(0)
    expect(mockedCalculateBilling).not.toHaveBeenCalled()
  })

  it("returns 0 amount for FIXED billing when no overrides", () => {
    const client = makeClient({ billingMode: "FIXED" as never })
    const issueMap = new Map<string, { estimate: number | undefined }>()

    const result = computeGroupAmount([], issueMap, client)

    expect(result.amount).toBe(0)
    expect(result.hours).toBe(0)
  })

  it("sums amounts from calculateBilling for non-FIXED modes", () => {
    const client = makeClient({ billingMode: "HOURLY" as never })
    const overrides = [makeOverride("issue-1"), makeOverride("issue-2")]
    const issueMap = new Map([
      ["issue-1", { estimate: 5 }],
      ["issue-2", { estimate: 3 }],
    ])

    mockedCalculateBilling
      .mockReturnValueOnce({ amount: 500, formula: "5h x 100" })
      .mockReturnValueOnce({ amount: 300, formula: "3h x 100" })

    const result = computeGroupAmount(overrides, issueMap, client)

    expect(result.amount).toBe(800)
    expect(result.hours).toBe(8)
    expect(mockedCalculateBilling).toHaveBeenCalledTimes(2)
  })

  it("passes correct parameters to calculateBilling", () => {
    const client = makeClient({ billingMode: "HOURLY" as never })
    const overrides = [makeOverride("issue-1", 150)]
    const issueMap = new Map([["issue-1", { estimate: 5 }]])

    mockedCalculateBilling.mockReturnValue({ amount: 750, formula: "5h x 150" })

    computeGroupAmount(overrides, issueMap, client)

    expect(mockedCalculateBilling).toHaveBeenCalledWith({
      billingMode: "HOURLY",
      rate: 100,
      estimate: 5,
      rateOverride: 150,
    })
  })

  it("handles missing issue in issueMap (undefined estimate)", () => {
    const client = makeClient({ billingMode: "HOURLY" as never })
    const overrides = [makeOverride("missing-issue")]
    const issueMap = new Map<string, { estimate: number | undefined }>()

    mockedCalculateBilling.mockReturnValue({
      amount: 0,
      formula: "No estimate",
    })

    const result = computeGroupAmount(overrides, issueMap, client)

    expect(result.amount).toBe(0)
    expect(result.hours).toBe(0)
    expect(mockedCalculateBilling).toHaveBeenCalledWith({
      billingMode: "HOURLY",
      rate: 100,
      estimate: undefined,
      rateOverride: null,
    })
  })

  it("rounds total amount to 2 decimal places", () => {
    const client = makeClient({ billingMode: "HOURLY" as never })
    const overrides = [makeOverride("issue-1"), makeOverride("issue-2")]
    const issueMap = new Map([
      ["issue-1", { estimate: 1 }],
      ["issue-2", { estimate: 1 }],
    ])

    mockedCalculateBilling
      .mockReturnValueOnce({ amount: 33.333, formula: "" })
      .mockReturnValueOnce({ amount: 33.333, formula: "" })

    const result = computeGroupAmount(overrides, issueMap, client)

    expect(result.amount).toBe(66.67)
  })

  it("does not count hours when estimate is undefined", () => {
    const client = makeClient({ billingMode: "DAILY" as never })
    const overrides = [makeOverride("issue-1"), makeOverride("issue-2")]
    const issueMap = new Map<string, { estimate: number | undefined }>([
      ["issue-1", { estimate: 5 }],
      ["issue-2", { estimate: undefined }],
    ])

    mockedCalculateBilling.mockReturnValue({ amount: 100, formula: "" })

    const result = computeGroupAmount(overrides, issueMap, client)

    expect(result.hours).toBe(5)
  })

  it("uses null rateOverride when override has no rateOverride", () => {
    const client = makeClient({ billingMode: "HOURLY" as never })
    const overrides = [makeOverride("issue-1", null)]
    const issueMap = new Map([["issue-1", { estimate: 2 }]])

    mockedCalculateBilling.mockReturnValue({ amount: 200, formula: "" })

    computeGroupAmount(overrides, issueMap, client)

    expect(mockedCalculateBilling).toHaveBeenCalledWith(
      expect.objectContaining({ rateOverride: null }),
    )
  })
})

// ---------------------------------------------------------------------------
// fetchIssueMapForClient
// ---------------------------------------------------------------------------
describe("fetchIssueMapForClient", () => {
  const mockedFetchLinearIssues = vi.mocked(fetchLinearIssues)

  beforeEach(() => {
    vi.resetAllMocks()
  })

  function makeClientWithMappings(
    mappings: Array<{
      linearTeamId?: string | null
      linearProjectId?: string | null
    }>,
  ) {
    return {
      id: "client-1",
      name: "Test Client",
      billingMode: "HOURLY",
      rate: 100,
      email: null,
      company: null,
      logo: null,
      category: "FREELANCE",
      notes: null,
      archivedAt: null,
      userId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      linearMappings: mappings.map((m, i) => ({
        id: `mapping-${i}`,
        clientId: "client-1",
        linearTeamId: m.linearTeamId ?? null,
        linearProjectId: m.linearProjectId ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    } as unknown as Parameters<typeof fetchIssueMapForClient>[0]
  }

  it("returns empty map when client has no mappings", async () => {
    const client = makeClientWithMappings([])

    const result = await fetchIssueMapForClient(client)

    expect(result.size).toBe(0)
    expect(mockedFetchLinearIssues).not.toHaveBeenCalled()
  })

  it("fetches issues for each mapping and builds a map", async () => {
    const client = makeClientWithMappings([
      { linearTeamId: "team-1", linearProjectId: "proj-1" },
    ])

    mockedFetchLinearIssues.mockResolvedValue([
      { id: "issue-1", estimate: 5, projectId: "proj-1" } as never,
      { id: "issue-2", estimate: 3, projectId: "proj-1" } as never,
    ])

    const result = await fetchIssueMapForClient(client)

    expect(result.size).toBe(2)
    expect(result.get("issue-1")).toEqual({
      estimate: 5,
      projectId: "proj-1",
    })
    expect(result.get("issue-2")).toEqual({
      estimate: 3,
      projectId: "proj-1",
    })
  })

  it("passes correct params to fetchLinearIssues", async () => {
    const client = makeClientWithMappings([
      { linearTeamId: "team-1", linearProjectId: "proj-1" },
    ])

    mockedFetchLinearIssues.mockResolvedValue([])

    await fetchIssueMapForClient(client)

    expect(mockedFetchLinearIssues).toHaveBeenCalledWith({
      teamId: "team-1",
      projectId: "proj-1",
    })
  })

  it("converts null teamId/projectId to undefined", async () => {
    const client = makeClientWithMappings([
      { linearTeamId: null, linearProjectId: null },
    ])

    mockedFetchLinearIssues.mockResolvedValue([])

    await fetchIssueMapForClient(client)

    expect(mockedFetchLinearIssues).toHaveBeenCalledWith({
      teamId: undefined,
      projectId: undefined,
    })
  })

  it("merges issues from multiple mappings", async () => {
    const client = makeClientWithMappings([
      { linearTeamId: "team-1" },
      { linearTeamId: "team-2" },
    ])

    mockedFetchLinearIssues
      .mockResolvedValueOnce([
        { id: "issue-1", estimate: 5, projectId: "p1" } as never,
      ])
      .mockResolvedValueOnce([
        { id: "issue-2", estimate: 3, projectId: "p2" } as never,
      ])

    const result = await fetchIssueMapForClient(client)

    expect(result.size).toBe(2)
    expect(result.has("issue-1")).toBe(true)
    expect(result.has("issue-2")).toBe(true)
  })

  it("ignores rejected promises from fetchLinearIssues", async () => {
    const client = makeClientWithMappings([
      { linearTeamId: "team-1" },
      { linearTeamId: "team-2" },
    ])

    mockedFetchLinearIssues
      .mockRejectedValueOnce(new Error("API error"))
      .mockResolvedValueOnce([
        { id: "issue-2", estimate: 3, projectId: "p2" } as never,
      ])

    const result = await fetchIssueMapForClient(client)

    expect(result.size).toBe(1)
    expect(result.get("issue-2")).toEqual({
      estimate: 3,
      projectId: "p2",
    })
  })

  it("handles issues with undefined estimate", async () => {
    const client = makeClientWithMappings([{ linearTeamId: "team-1" }])

    mockedFetchLinearIssues.mockResolvedValue([
      { id: "issue-1", estimate: undefined, projectId: undefined } as never,
    ])

    const result = await fetchIssueMapForClient(client)

    expect(result.get("issue-1")).toEqual({
      estimate: undefined,
      projectId: undefined,
    })
  })
})
