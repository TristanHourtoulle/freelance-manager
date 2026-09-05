import { describe, expect, it } from "vitest"
import { isQuoteExpired, parisEndOfDay, quoteBadgeCutoff } from "./expiry"

describe("parisEndOfDay", () => {
  it("resolves to 22:59:59.999 UTC in winter (CET, UTC+1)", () => {
    const validUntil = new Date("2026-01-15T00:00:00.000Z")
    expect(parisEndOfDay(validUntil).toISOString()).toBe(
      "2026-01-15T22:59:59.999Z",
    )
  })

  it("resolves to 21:59:59.999 UTC in summer (CEST, UTC+2)", () => {
    const validUntil = new Date("2026-08-01T00:00:00.000Z")
    expect(parisEndOfDay(validUntil).toISOString()).toBe(
      "2026-08-01T21:59:59.999Z",
    )
  })
})

describe("isQuoteExpired", () => {
  it("never expires a null validUntil", () => {
    expect(isQuoteExpired(null, new Date("2999-01-01T00:00:00.000Z"))).toBe(
      false,
    )
  })

  it("reproduces the reported bug's exact instants correctly: 10:00 UTC on the valid day is not expired", () => {
    const validUntil = new Date("2026-08-01")
    const now = new Date("2026-08-01T10:00:00.000Z")
    expect(isQuoteExpired(validUntil, now)).toBe(false)
  })

  it("is not expired at the exact Paris end-of-day boundary instant (inclusive)", () => {
    const validUntil = new Date("2026-08-01T00:00:00.000Z")
    const boundary = new Date("2026-08-01T21:59:59.999Z")
    expect(isQuoteExpired(validUntil, boundary)).toBe(false)
  })

  it("is expired 1ms after the Paris end-of-day boundary instant", () => {
    const validUntil = new Date("2026-08-01T00:00:00.000Z")
    const pastBoundary = new Date("2026-08-01T22:00:00.000Z")
    expect(isQuoteExpired(validUntil, pastBoundary)).toBe(true)
  })

  it("expires a quote the day after its validUntil day", () => {
    const validUntil = new Date("2026-08-01T00:00:00.000Z")
    const nextMorning = new Date("2026-08-02T06:00:00.000Z")
    expect(isQuoteExpired(validUntil, nextMorning)).toBe(true)
  })
})

describe("quoteBadgeCutoff", () => {
  it("is today's UTC midnight when today is not yet expired", () => {
    const now = new Date("2026-08-01T10:00:00.000Z")
    expect(quoteBadgeCutoff(now).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    )
  })

  it("rolls over to tomorrow once today's Paris end-of-day has passed", () => {
    const now = new Date("2026-08-01T22:30:00.000Z")
    expect(quoteBadgeCutoff(now).toISOString()).toBe(
      "2026-08-02T00:00:00.000Z",
    )
  })

  it("agrees with isQuoteExpired: today's quote counts as valid exactly when validUntil >= cutoff", () => {
    const now = new Date("2026-08-01T22:30:00.000Z")
    const cutoff = quoteBadgeCutoff(now)
    const today = new Date("2026-08-01T00:00:00.000Z")
    const tomorrow = new Date("2026-08-02T00:00:00.000Z")

    expect(today.getTime() >= cutoff.getTime()).toBe(
      !isQuoteExpired(today, now),
    )
    expect(tomorrow.getTime() >= cutoff.getTime()).toBe(
      !isQuoteExpired(tomorrow, now),
    )
  })
})
