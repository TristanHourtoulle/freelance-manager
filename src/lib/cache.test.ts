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

  describe("getMetadata", () => {
    it("returns undefined for a missing key", () => {
      const cache = new TTLCache<string>(1000)
      expect(cache.getMetadata("nonexistent")).toBeUndefined()
    })

    it("returns metadata with correct timestamps for a valid entry", () => {
      const cache = new TTLCache<string>(5000)
      const now = Date.now()

      cache.set("key", "value")

      const metadata = cache.getMetadata("key")
      expect(metadata).toBeDefined()
      expect(metadata!.setAt).toBe(now)
      expect(metadata!.expiresAt).toBe(now + 5000)
      expect(metadata!.isExpired).toBe(false)
    })

    it("reports isExpired=true after TTL expires", () => {
      const cache = new TTLCache<string>(1000)
      cache.set("key", "value")

      vi.advanceTimersByTime(1000)

      const metadata = cache.getMetadata("key")
      expect(metadata).toBeDefined()
      expect(metadata!.isExpired).toBe(true)
    })

    it("reports isExpired=false just before TTL expires", () => {
      const cache = new TTLCache<string>(1000)
      cache.set("key", "value")

      vi.advanceTimersByTime(999)

      const metadata = cache.getMetadata("key")
      expect(metadata).toBeDefined()
      expect(metadata!.isExpired).toBe(false)
    })

    it("returns metadata with custom TTL", () => {
      const cache = new TTLCache<string>(1000)
      const now = Date.now()

      cache.set("key", "value", 3000)

      const metadata = cache.getMetadata("key")
      expect(metadata).toBeDefined()
      expect(metadata!.expiresAt).toBe(now + 3000)
    })
  })

  describe("edge cases", () => {
    it("treats exact expiry boundary as expired for get", () => {
      const cache = new TTLCache<string>(1000)
      cache.set("key", "value")

      vi.advanceTimersByTime(1000)

      // At exactly expiresAt, the entry should be considered expired
      expect(cache.get("key")).toBeUndefined()
    })

    it("deletes expired entry on get and subsequent get returns undefined", () => {
      const cache = new TTLCache<string>(500)
      cache.set("key", "value")

      vi.advanceTimersByTime(500)

      // First get deletes it
      expect(cache.get("key")).toBeUndefined()
      // Metadata also reflects removal
      expect(cache.getMetadata("key")).toBeUndefined()
    })
  })
})
