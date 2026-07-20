import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  decimalToNumber: (
    d: { toNumber?: () => number } | number | null | undefined,
  ) =>
    d == null ? null : typeof d === "number" ? d : (d.toNumber?.() ?? null),
}))

import {
  buildCategoryMix,
  type CategoryMixClient,
  type CategoryMixTask,
} from "./category-mix"

function task(
  clientId: string,
  estimate: number | null,
  actualDays: number | null = null,
): CategoryMixTask {
  return { clientId, estimate, actualDays }
}

const CLIENTS: CategoryMixClient[] = [
  { id: "c1", category: "FREELANCE" },
  { id: "c2", category: "SIDE_PROJECT" },
  { id: "c3", category: "STUDY" },
]

describe("buildCategoryMix", () => {
  it("splits task counts, days and revenue by category", () => {
    const mix = buildCategoryMix(
      CLIENTS,
      [task("c1", 3), task("c1", 2, 4), task("c2", 1), task("c3", 2)],
      new Map([
        ["c1", 9000],
        ["c2", 500],
      ]),
    )

    expect(mix.rows).toEqual([
      { category: "FREELANCE", taskCount: 2, days: 7, revenue: 9000 },
      { category: "STUDY", taskCount: 1, days: 2, revenue: 0 },
      { category: "SIDE_PROJECT", taskCount: 1, days: 1, revenue: 500 },
    ])
    expect(mix.totalDays).toBe(10)
  })

  it("ignores tasks whose client is not in the active client set", () => {
    const mix = buildCategoryMix(
      CLIENTS,
      [task("c1", 2), task("archived", 100)],
      new Map(),
    )

    expect(mix.totalDays).toBe(2)
    expect(mix.rows).toHaveLength(1)
  })

  it("reports a zero non-freelance share on all-freelance data", () => {
    const mix = buildCategoryMix(
      [{ id: "c1", category: "FREELANCE" }],
      [task("c1", 4)],
      new Map(),
    )

    expect(mix.nonFreelanceDaysShare).toBe(0)
  })

  it("returns null rather than NaN when no effort is recorded", () => {
    const mix = buildCategoryMix(
      CLIENTS,
      [task("c1", null), task("c2", null)],
      new Map(),
    )

    expect(mix.totalDays).toBe(0)
    expect(mix.nonFreelanceDaysShare).toBeNull()
    expect(Number.isNaN(mix.nonFreelanceDaysShare as unknown as number)).toBe(
      false,
    )
  })

  it("keeps a client with effort but no revenue at zero revenue", () => {
    const mix = buildCategoryMix(
      [{ id: "c2", category: "SIDE_PROJECT" }],
      [task("c2", 3)],
      new Map(),
    )

    expect(mix.rows[0]).toEqual({
      category: "SIDE_PROJECT",
      taskCount: 1,
      days: 3,
      revenue: 0,
    })
  })

  it("omits categories that are absent from the data", () => {
    const mix = buildCategoryMix(CLIENTS, [task("c1", 1)], new Map())

    expect(mix.rows.map((r) => r.category)).toEqual(["FREELANCE"])
  })

  it("orders ties on days deterministically by category", () => {
    const mix = buildCategoryMix(
      [
        { id: "c1", category: "STUDY" },
        { id: "c2", category: "PERSONAL" },
        { id: "c3", category: "FREELANCE" },
      ],
      [task("c1", 2), task("c2", 2), task("c3", 2)],
      new Map(),
    )

    expect(mix.rows.map((r) => r.category)).toEqual([
      "FREELANCE",
      "PERSONAL",
      "STUDY",
    ])
  })

  it("computes the non-freelance share over mixed effort", () => {
    const mix = buildCategoryMix(
      CLIENTS,
      [task("c1", 6), task("c2", 2), task("c3", 2)],
      new Map(),
    )

    expect(mix.nonFreelanceDaysShare).toBe(0.4)
  })
})
