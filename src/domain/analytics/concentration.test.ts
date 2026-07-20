import { describe, expect, it } from "vitest"

import {
  buildConcentration,
  CONCENTRATION_DANGER_SHARE,
  CONCENTRATION_WARN_SHARE,
  type ClientWeightRow,
} from "./concentration"

function row(clientId: string, revenue: number, days = 0): ClientWeightRow {
  return { clientId, revenue, days }
}

describe("buildConcentration", () => {
  it("splits the revenue shares so they sum to 1", () => {
    const summary = buildConcentration([
      row("c1", 400),
      row("c2", 300),
      row("c3", 200),
      row("c4", 100),
    ])

    expect(summary.totalRevenue).toBe(1000)
    expect(summary.rows.map((r) => r.revenueShare)).toEqual([
      0.4, 0.3, 0.2, 0.1,
    ])
    expect(
      summary.rows.reduce((s, r) => s + (r.revenueShare ?? 0), 0),
    ).toBeCloseTo(1)
  })

  it("computes shares over every client, before any top-5 truncation", () => {
    const all = [
      row("c1", 100),
      row("c2", 50),
      row("c3", 30),
      row("c4", 20),
      row("c5", 10),
      row("c6", 5),
    ]

    const summary = buildConcentration(all)

    expect(summary.totalRevenue).toBe(215)
    expect(summary.rows[0]?.revenueShare).toBe(100 / 215)
    expect(summary.rows[0]?.revenueShare).not.toBe(100 / 210)
    expect(summary.rows.slice(0, 5).map((r) => r.revenueShare)).toEqual([
      100 / 215,
      50 / 215,
      30 / 215,
      20 / 215,
      10 / 215,
    ])
  })

  it("returns null shares rather than Infinity or NaN on a zero revenue total", () => {
    const summary = buildConcentration([row("c1", 0, 3), row("c2", 0, 1)])

    expect(summary.topClientShare).toBeNull()
    expect(summary.topThreeShare).toBeNull()
    expect(summary.level).toBe("ok")
    for (const r of summary.rows) {
      expect(r.revenueShare).toBeNull()
      expect(Number.isNaN(r.revenueShare as unknown as number)).toBe(false)
      expect(r.revenueShare).not.toBe(Number.POSITIVE_INFINITY)
    }
  })

  it("nulls the days share when no effort was recorded but keeps the revenue share", () => {
    const summary = buildConcentration([row("c1", 900, 0), row("c2", 100, 0)])

    expect(summary.totalDays).toBe(0)
    expect(summary.rows[0]?.revenueShare).toBe(0.9)
    expect(summary.rows[0]?.daysShare).toBeNull()
  })

  it("surfaces effort without revenue as a zero revenue share and a real days share", () => {
    const summary = buildConcentration([row("c1", 1000, 5), row("c2", 0, 5)])

    const unpaid = summary.rows.find((r) => r.clientId === "c2")
    expect(unpaid?.revenueShare).toBe(0)
    expect(unpaid?.daysShare).toBe(0.5)
  })

  it("treats non-finite weights as zero in the totals and null in the share", () => {
    const summary = buildConcentration([
      row("c1", 100, 10),
      row("c2", Number.NaN, Number.POSITIVE_INFINITY),
    ])

    expect(summary.totalRevenue).toBe(100)
    expect(summary.totalDays).toBe(10)
    const broken = summary.rows.find((r) => r.clientId === "c2")
    expect(broken?.revenueShare).toBeNull()
    expect(broken?.daysShare).toBeNull()
  })

  it("maps the top-client share onto the threshold bands", () => {
    expect(buildConcentration([row("c1", 60), row("c2", 40)]).level).toBe(
      "danger",
    )
    expect(
      buildConcentration([row("c1", 40), row("c2", 35), row("c3", 25)]).level,
    ).toBe("warn")
    expect(
      buildConcentration([
        row("c1", 20),
        row("c2", 20),
        row("c3", 20),
        row("c4", 20),
        row("c5", 20),
      ]).level,
    ).toBe("ok")
  })

  it("treats the exact threshold values as inclusive boundaries", () => {
    const danger = buildConcentration([row("c1", 50), row("c2", 50)])
    expect(danger.topClientShare).toBe(CONCENTRATION_DANGER_SHARE)
    expect(danger.level).toBe("danger")

    const warn = buildConcentration([
      row("c1", 35),
      row("c2", 33),
      row("c3", 32),
    ])
    expect(warn.topClientShare).toBe(CONCENTRATION_WARN_SHARE)
    expect(warn.level).toBe("warn")
  })

  it("sums the top three revenues for topThreeShare", () => {
    const summary = buildConcentration([
      row("c1", 50),
      row("c2", 30),
      row("c3", 10),
      row("c4", 10),
    ])

    expect(summary.topThreeShare).toBe(0.9)
  })

  it("orders ties deterministically by clientId", () => {
    const summary = buildConcentration([
      row("zz", 100),
      row("aa", 100),
      row("mm", 100),
    ])

    expect(summary.rows.map((r) => r.clientId)).toEqual(["aa", "mm", "zz"])
  })

  it("returns a zeroed summary for empty input", () => {
    expect(buildConcentration([])).toEqual({
      rows: [],
      totalRevenue: 0,
      totalDays: 0,
      topClientShare: null,
      topThreeShare: null,
      level: "ok",
    })
  })
})
