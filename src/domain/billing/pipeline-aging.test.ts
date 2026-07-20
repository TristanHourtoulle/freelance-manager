import { describe, expect, it } from "vitest"

import {
  buildPipelineAging,
  PIPELINE_STALE_DAYS,
  type AgingTaskRow,
} from "./pipeline-aging"

const NOW = new Date(2026, 2, 15, 12, 0, 0)
const DAY_MS = 86_400_000

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS)
}

function row(days: number | null, value = 0): AgingTaskRow {
  return { completedAt: days === null ? null : daysAgo(days), value }
}

describe("buildPipelineAging", () => {
  it("places tasks in the fresh, warm and stale buckets at the boundaries", () => {
    const aging = buildPipelineAging(NOW, [
      row(0),
      row(7),
      row(8),
      row(PIPELINE_STALE_DAYS),
      row(PIPELINE_STALE_DAYS + 1),
    ])

    expect(aging.buckets).toEqual({
      fresh: 2,
      warm: 2,
      stale: 1,
      undated: 0,
    })
  })

  it("reports the maximum age as oldestDays", () => {
    const aging = buildPipelineAging(NOW, [row(3), row(45), row(12)])

    expect(aging.oldestDays).toBe(45)
  })

  it("keeps undated rows out of oldestDays", () => {
    const aging = buildPipelineAging(NOW, [row(null), row(null)])

    expect(aging.oldestDays).toBeNull()
    expect(aging.buckets.undated).toBe(2)
    expect(aging.staleCount).toBe(0)
  })

  it("clamps a future completion date to an age of zero", () => {
    const aging = buildPipelineAging(NOW, [
      { completedAt: new Date(NOW.getTime() + 3 * DAY_MS), value: 100 },
    ])

    expect(aging.oldestDays).toBe(0)
    expect(aging.buckets.fresh).toBe(1)
  })

  it("sums staleValue over the stale rows only", () => {
    const aging = buildPipelineAging(NOW, [
      row(2, 1000),
      row(20, 2000),
      row(40, 900),
      row(90, 100),
    ])

    expect(aging.staleCount).toBe(2)
    expect(aging.staleValue).toBe(1000)
  })

  it("treats a non-finite value as zero", () => {
    const aging = buildPipelineAging(NOW, [row(60, Number.NaN), row(60, 500)])

    expect(aging.staleValue).toBe(500)
  })

  it("returns a zeroed profile for empty input", () => {
    expect(buildPipelineAging(NOW, [])).toEqual({
      oldestDays: null,
      staleCount: 0,
      staleValue: 0,
      buckets: { fresh: 0, warm: 0, stale: 0, undated: 0 },
    })
  })
})
