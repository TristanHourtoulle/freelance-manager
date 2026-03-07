import { describe, it, expect } from "vitest"
import { fuzzyMatch, fuzzyFilter } from "./fuzzy-match"

describe("fuzzyMatch", () => {
  it("matches exact string", () => {
    const result = fuzzyMatch("Dashboard", "Dashboard")
    expect(result.isMatch).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it("matches substring", () => {
    const result = fuzzyMatch("dash", "Dashboard")
    expect(result.isMatch).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it("matches case-insensitively", () => {
    const result = fuzzyMatch("DASH", "dashboard")
    expect(result.isMatch).toBe(true)
  })

  it("matches fuzzy characters in order", () => {
    const result = fuzzyMatch("dbd", "Dashboard")
    expect(result.isMatch).toBe(true)
  })

  it("does not match when characters are out of order", () => {
    const result = fuzzyMatch("bda", "Dashboard")
    expect(result.isMatch).toBe(false)
  })

  it("does not match when query has extra characters", () => {
    const result = fuzzyMatch("dashboardxyz", "Dashboard")
    expect(result.isMatch).toBe(false)
  })

  it("returns isMatch true with score 0 for empty query", () => {
    const result = fuzzyMatch("", "Dashboard")
    expect(result.isMatch).toBe(true)
    expect(result.score).toBe(0)
  })

  it("scores substring match higher than fuzzy match", () => {
    const substring = fuzzyMatch("cli", "Clients")
    const fuzzy = fuzzyMatch("cls", "Clients")
    expect(substring.score).toBeGreaterThan(fuzzy.score)
  })

  it("scores earlier position higher", () => {
    const early = fuzzyMatch("da", "Dashboard")
    const late = fuzzyMatch("da", "xxxDashboard")
    expect(early.score).toBeGreaterThan(late.score)
  })
})

describe("fuzzyFilter", () => {
  const items = [
    { name: "Dashboard" },
    { name: "Clients" },
    { name: "Tasks" },
    { name: "Settings" },
  ]

  it("returns all items for empty query", () => {
    const result = fuzzyFilter("", items, (i) => i.name)
    expect(result).toHaveLength(4)
  })

  it("filters items matching query", () => {
    const result = fuzzyFilter("cli", items, (i) => i.name)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("Clients")
  })

  it("returns empty array when no matches", () => {
    const result = fuzzyFilter("xyz", items, (i) => i.name)
    expect(result).toHaveLength(0)
  })

  it("sorts by score descending", () => {
    const result = fuzzyFilter("set", items, (i) => i.name)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe("Settings")
  })
})
