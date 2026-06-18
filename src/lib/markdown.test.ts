import { describe, it, expect } from "vitest"
import { parseInlineTokens, parseMarkdown } from "./markdown"

describe("parseInlineTokens", () => {
  it("returns a single text token for plain text", () => {
    expect(parseInlineTokens("hello world")).toEqual([
      { type: "text", value: "hello world" },
    ])
  })

  it("parses bold, italic and code spans", () => {
    expect(parseInlineTokens("a **b** c")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " c" },
    ])
    expect(parseInlineTokens("_i_")).toEqual([
      { type: "em", children: [{ type: "text", value: "i" }] },
    ])
    expect(parseInlineTokens("`x = 1`")).toEqual([
      { type: "code", value: "x = 1" },
    ])
  })

  it("keeps safe links and degrades unsafe ones to text", () => {
    expect(parseInlineTokens("[site](https://a.com)")).toEqual([
      { type: "link", value: "site", href: "https://a.com" },
    ])
    expect(parseInlineTokens("[x](javascript:boom)")).toEqual([
      { type: "text", value: "x" },
    ])
  })
})

describe("parseMarkdown", () => {
  it("parses headings with the right level", () => {
    const blocks = parseMarkdown("# Title\n## Sub")
    expect(blocks[0]).toEqual({
      type: "heading",
      level: 1,
      inline: [{ type: "text", value: "Title" }],
    })
    expect(blocks[1]?.type).toBe("heading")
    if (blocks[1]?.type === "heading") expect(blocks[1].level).toBe(2)
  })

  it("groups unordered and ordered list items", () => {
    const ul = parseMarkdown("- one\n- two")[0]
    expect(ul?.type).toBe("ul")
    if (ul?.type === "ul") expect(ul.items).toHaveLength(2)

    const ol = parseMarkdown("1. a\n2. b\n3. c")[0]
    expect(ol?.type).toBe("ol")
    if (ol?.type === "ol") expect(ol.items).toHaveLength(3)
  })

  it("separates paragraphs on blank lines and joins wrapped lines", () => {
    const blocks = parseMarkdown("line one\nline two\n\nsecond para")
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toEqual({
      type: "paragraph",
      inline: [{ type: "text", value: "line one line two" }],
    })
  })

  it("parses blockquotes and fenced code", () => {
    const q = parseMarkdown("> quoted")[0]
    expect(q?.type).toBe("quote")

    const code = parseMarkdown("```\nconst a = 1\n```")[0]
    expect(code).toEqual({ type: "code", value: "const a = 1" })
  })

  it("returns an empty array for empty input", () => {
    expect(parseMarkdown("")).toEqual([])
    expect(parseMarkdown("   \n  ")).toEqual([])
  })
})
