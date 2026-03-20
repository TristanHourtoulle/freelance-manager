import { describe, it, expect } from "vitest"
import { formatCurrency, normalizeLineBreaks } from "@/lib/format"

describe("formatCurrency", () => {
  it("defaults to EUR", () => {
    const result = formatCurrency(1500)

    // Verify it contains the amount and EUR symbol
    expect(result).toContain("1")
    expect(result).toContain("500")
    expect(result).toMatch(/€/)
  })

  it("formats as USD when specified", () => {
    const result = formatCurrency(1500, "USD")

    expect(result).toContain("1")
    expect(result).toContain("500")
    expect(result).toMatch(/\$/)
  })

  it("formats as GBP when specified", () => {
    const result = formatCurrency(1500, "GBP")

    expect(result).toContain("1")
    expect(result).toContain("500")
    expect(result).toMatch(/£/)
  })

  it("formats zero correctly", () => {
    const result = formatCurrency(0)

    expect(result).toContain("0")
    expect(result).toMatch(/€/)
  })

  it("formats negative amounts", () => {
    const result = formatCurrency(-250)

    expect(result).toContain("250")
    expect(result).toMatch(/€/)
  })
})

describe("normalizeLineBreaks", () => {
  it("inserts blank lines between regular lines", () => {
    const input = "Line one\nLine two\nLine three"
    const result = normalizeLineBreaks(input)

    expect(result).toBe("Line one\n\nLine two\n\nLine three")
  })

  it("preserves existing blank lines", () => {
    const input = "Line one\n\nLine two"
    const result = normalizeLineBreaks(input)

    expect(result).toBe("Line one\n\nLine two")
  })

  it("preserves fenced code blocks", () => {
    const input = "Before\n```\ncode line 1\ncode line 2\n```\nAfter"
    const result = normalizeLineBreaks(input)

    expect(result).toContain("code line 1\ncode line 2")
  })

  it("does not add blank lines between consecutive list items", () => {
    const input = "- item 1\n- item 2\n- item 3"
    const result = normalizeLineBreaks(input)

    expect(result).toBe("- item 1\n- item 2\n- item 3")
  })
})
