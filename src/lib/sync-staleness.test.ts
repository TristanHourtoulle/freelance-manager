import { describe, expect, it } from "vitest"
import { isSyncStale, SYNC_STALE_AFTER_MS } from "@/lib/sync-staleness"

const NOW = new Date("2026-07-20T12:00:00.000Z").getTime()

describe("isSyncStale", () => {
  it("treats a never-synced account as stale", () => {
    expect(isSyncStale(null, NOW)).toBe(true)
    expect(isSyncStale(undefined, NOW)).toBe(true)
  })

  it("returns false for a sync that just happened", () => {
    expect(isSyncStale(new Date(NOW - 60_000), NOW)).toBe(false)
  })

  it("returns false exactly at the threshold", () => {
    expect(isSyncStale(new Date(NOW - SYNC_STALE_AFTER_MS), NOW)).toBe(false)
  })

  it("returns true one millisecond past the threshold", () => {
    expect(isSyncStale(new Date(NOW - SYNC_STALE_AFTER_MS - 1), NOW)).toBe(true)
  })

  it("accepts an ISO string", () => {
    expect(isSyncStale("2026-07-20T11:00:00.000Z", NOW)).toBe(false)
    expect(isSyncStale("2026-07-01T11:00:00.000Z", NOW)).toBe(true)
  })

  it("treats an unparsable timestamp as stale", () => {
    expect(isSyncStale("not-a-date", NOW)).toBe(true)
  })

  it("uses a 24h threshold", () => {
    expect(SYNC_STALE_AFTER_MS).toBe(24 * 60 * 60 * 1000)
  })
})
