import { describe, it, expect } from "vitest"
import {
  fmtEUR,
  fmtEURprecise,
  fmtDate,
  fmtDateShort,
  fmtRelative,
  initials,
  avatarColor,
} from "@/lib/format"

describe("fmtEUR", () => {
  it("formats integers with euro sign", () => {
    const r = fmtEUR(1500)
    expect(r).toContain("1")
    expect(r).toContain("500")
    expect(r).toMatch(/€/)
  })

  it("renders em-dash for null/undefined/NaN", () => {
    expect(fmtEUR(null)).toBe("—")
    expect(fmtEUR(undefined)).toBe("—")
    expect(fmtEUR(Number.NaN)).toBe("—")
  })
})

describe("fmtEURprecise", () => {
  it("always uses 2 decimal digits", () => {
    const r = fmtEURprecise(1500)
    expect(r).toMatch(/1\s?500,00/)
  })
})

describe("fmtDate", () => {
  it("formats ISO date in French long form", () => {
    const r = fmtDate("2026-04-30")
    expect(r).toMatch(/avr\.?/)
    expect(r).toContain("2026")
  })

  it("returns em-dash for falsy input", () => {
    expect(fmtDate("")).toBe("—")
    expect(fmtDate(null)).toBe("—")
  })
})

describe("fmtDateShort", () => {
  it("omits the year", () => {
    const r = fmtDateShort("2026-04-30")
    expect(r).not.toContain("2026")
    expect(r).toMatch(/avr\.?/)
  })
})

describe("fmtRelative", () => {
  it("returns 'aujourd'hui' for today", () => {
    expect(fmtRelative(new Date())).toBe("aujourd'hui")
  })

  it("returns 'hier' for yesterday", () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    expect(fmtRelative(d)).toBe("hier")
  })

  it("returns 'il y a Nj' for recent past", () => {
    const d = new Date()
    d.setDate(d.getDate() - 4)
    expect(fmtRelative(d)).toBe("il y a 4j")
  })
})

describe("initials", () => {
  it("returns two uppercase initials", () => {
    expect(initials("Henri Mistral")).toBe("HM")
  })

  it("handles single-word strings", () => {
    expect(initials("Acme")).toBe("A")
  })

  it("collapses extra whitespace", () => {
    expect(initials("  Coralie   Ebring  ")).toBe("CE")
  })
})

describe("avatarColor", () => {
  it("is deterministic for the same seed", () => {
    expect(avatarColor("Henri")).toBe(avatarColor("Henri"))
  })

  it("returns a CSS linear-gradient", () => {
    expect(avatarColor("Henri")).toContain("linear-gradient")
  })
})
