import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TTLCache } from "./cache"

describe("TTLCache", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns undefined for missing key", () => {
    const cache = new TTLCache<string>(1000)
    expect(cache.get("missing")).toBeUndefined()
  })

  it("stores and retrieves a value", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("key", "value")
    expect(cache.get("key")).toBe("value")
  })

  it("returns undefined after TTL expires", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("key", "value")

    vi.advanceTimersByTime(999)
    expect(cache.get("key")).toBe("value")

    vi.advanceTimersByTime(1)
    expect(cache.get("key")).toBeUndefined()
  })

  it("supports custom TTL per entry", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("short", "value", 500)
    cache.set("long", "value", 2000)

    vi.advanceTimersByTime(600)
    expect(cache.get("short")).toBeUndefined()
    expect(cache.get("long")).toBe("value")
  })

  it("deletes a specific key", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("a", "1")
    cache.set("b", "2")

    cache.delete("a")
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBe("2")
  })

  it("clears all entries", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("a", "1")
    cache.set("b", "2")

    cache.clear()
    expect(cache.get("a")).toBeUndefined()
    expect(cache.get("b")).toBeUndefined()
  })

  it("overwrites existing entry on set", () => {
    const cache = new TTLCache<string>(1000)
    cache.set("key", "old")
    cache.set("key", "new")
    expect(cache.get("key")).toBe("new")
  })
})
