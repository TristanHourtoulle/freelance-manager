import { describe, expect, it } from "vitest"
import { resolveQuoteStatusTimestamps } from "./status-transition"

const NOW = new Date("2026-08-01T10:00:00.000Z")
const SENT_AT = new Date("2026-07-20T09:00:00.000Z")
const DECIDED_AT = new Date("2026-07-25T09:00:00.000Z")

describe("resolveQuoteStatusTimestamps", () => {
  it("stamps sentAt on the first move away from DRAFT", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "DRAFT", sentAt: null, decidedAt: null },
      "SENT",
      NOW,
    )
    expect(patch).toEqual({ sentAt: NOW })
  })

  it("stamps both sentAt and decidedAt when jumping straight from DRAFT to a decided status", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "DRAFT", sentAt: null, decidedAt: null },
      "ACCEPTED",
      NOW,
    )
    expect(patch).toEqual({ sentAt: NOW, decidedAt: NOW })
  })

  it("stamps decidedAt on the first move into a decided status", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "SENT", sentAt: SENT_AT, decidedAt: null },
      "ACCEPTED",
      NOW,
    )
    expect(patch).toEqual({ decidedAt: NOW })
  })

  it("does not re-stamp sentAt or decidedAt on a lateral move already past that stage", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "SENT", sentAt: SENT_AT, decidedAt: null },
      "SENT",
      NOW,
    )
    expect(patch).toEqual({})
  })

  it("leaves both timestamps untouched on a lateral move between two decided statuses", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "REFUSED", sentAt: SENT_AT, decidedAt: DECIDED_AT },
      "ACCEPTED",
      NOW,
    )
    expect(patch).toEqual({})
  })

  it("clears both timestamps when moving an ACCEPTED quote back to DRAFT", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "ACCEPTED", sentAt: SENT_AT, decidedAt: DECIDED_AT },
      "DRAFT",
      NOW,
    )
    expect(patch).toEqual({ sentAt: null, decidedAt: null })
  })

  it("clears only decidedAt when moving a REFUSED quote back to SENT", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "REFUSED", sentAt: SENT_AT, decidedAt: DECIDED_AT },
      "SENT",
      NOW,
    )
    expect(patch).toEqual({ decidedAt: null })
  })

  it("clears only decidedAt when moving an EXPIRED quote back to SENT", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "EXPIRED", sentAt: SENT_AT, decidedAt: DECIDED_AT },
      "SENT",
      NOW,
    )
    expect(patch).toEqual({ decidedAt: null })
  })

  it("is a no-op when nothing to clear and nothing new to stamp (DRAFT -> DRAFT)", () => {
    const patch = resolveQuoteStatusTimestamps(
      { status: "DRAFT", sentAt: null, decidedAt: null },
      "DRAFT",
      NOW,
    )
    expect(patch).toEqual({})
  })
})
