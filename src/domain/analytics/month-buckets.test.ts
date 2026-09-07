import { execFileSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { buildMonthlyBuckets, type MonthTotalRow } from "./month-buckets"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

describe("buildMonthlyBuckets", () => {
  it("keys each bucket by its own UTC month, independent of iteration order", () => {
    const referenceDate = new Date(Date.UTC(2026, 8, 6, 12, 0, 0))
    const paidByMonth: MonthTotalRow[] = [
      { month: new Date(Date.UTC(2026, 6, 1)), total: 1000 },
      { month: new Date(Date.UTC(2026, 7, 1)), total: 3550 },
      { month: new Date(Date.UTC(2026, 8, 1)), total: 954.94 },
    ]
    const issuedByMonth: MonthTotalRow[] = []

    const buckets = buildMonthlyBuckets(
      referenceDate,
      3,
      paidByMonth,
      issuedByMonth,
    )

    expect(buckets).toEqual([
      { label: "juil.", paid: 1000, issued: 0, isCurrent: false },
      { label: "août", paid: 3550, issued: 0, isCurrent: false },
      { label: "sept.", paid: 954.94, issued: 0, isCurrent: true },
    ])
  })

  it("carries a year boundary correctly (December into January)", () => {
    const referenceDate = new Date(Date.UTC(2026, 0, 15))
    const paidByMonth: MonthTotalRow[] = [
      { month: new Date(Date.UTC(2025, 11, 1)), total: 200 },
      { month: new Date(Date.UTC(2026, 0, 1)), total: 300 },
    ]

    const buckets = buildMonthlyBuckets(referenceDate, 2, paidByMonth, [])

    expect(buckets).toEqual([
      { label: "déc.", paid: 200, issued: 0, isCurrent: false },
      { label: "janv.", paid: 300, issued: 0, isCurrent: true },
    ])
  })

  it("defaults an unmatched month to zero rather than dropping the bucket", () => {
    const referenceDate = new Date(Date.UTC(2026, 8, 1))

    const buckets = buildMonthlyBuckets(referenceDate, 2, [], [])

    expect(buckets).toHaveLength(2)
    expect(buckets.every((b) => b.paid === 0 && b.issued === 0)).toBe(true)
  })

  /**
   * Regression guard for TRI-1218: `new Date(y, m, 1)` interprets its
   * arguments in the process's local timezone, so building a bucket start
   * that way and reading it back with `toISOString()` silently shifts every
   * key back a month under a positive UTC offset. `vi.setSystemTime` cannot
   * exercise this — it only fakes `Date.now()`, not the timezone the runtime
   * resolves component-based `Date` constructors against — and Node caches
   * the resolved timezone on first use, so mutating `process.env.TZ` inside
   * a running test process is unreliable too. Spawning a fresh child process
   * with `TZ` set in its environment is the one approach that genuinely
   * forces the non-UTC code path, regardless of the host machine's own
   * timezone (this sandbox happens to run at UTC+2, which is exactly why the
   * bug was first reproduced here, but the assertion must not depend on
   * that).
   */
  it("produces the correct July/August/September keys under a UTC+2 process timezone", () => {
    const scriptPath = path.join(__dirname, "month-buckets.tz-fixture.ts")
    const tsxBin = path.resolve(process.cwd(), "node_modules/.bin/tsx")

    const stdout = execFileSync(tsxBin, [scriptPath], {
      env: { ...process.env, TZ: "Europe/Paris" },
      encoding: "utf8",
    })

    expect(JSON.parse(stdout)).toEqual([
      { label: "juil.", paid: 1000, issued: 0, isCurrent: false },
      { label: "août", paid: 3550, issued: 0, isCurrent: false },
      { label: "sept.", paid: 954.94, issued: 0, isCurrent: true },
    ])
  })
})
