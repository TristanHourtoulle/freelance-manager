import type { ReactNode } from "react"

export type InlineToken =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineToken[] }
  | { type: "em"; children: InlineToken[] }
  | { type: "link"; value: string; href: string }

export type MdBlock =
  | { type: "heading"; level: 1 | 2 | 3; inline: InlineToken[] }
  | { type: "paragraph"; inline: InlineToken[] }
  | { type: "ul"; items: InlineToken[][] }
  | { type: "ol"; items: InlineToken[][] }
  | { type: "quote"; inline: InlineToken[] }
  | { type: "code"; value: string }

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/

/**
 * Tokenize a single line of inline markdown into a flat token list. Supports
 * code, bold, italic (asterisk or underscore) and [label](href) links. Links
 * are kept only for http(s) and root-relative hrefs; anything else is text.
 */
export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let rest = text
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest)
    if (!m) {
      tokens.push({ type: "text", value: rest })
      break
    }
    if (m.index > 0) {
      tokens.push({ type: "text", value: rest.slice(0, m.index) })
    }
    const tok = m[0]
    if (tok.startsWith("`")) {
      tokens.push({ type: "code", value: tok.slice(1, -1) })
    } else if (tok.startsWith("**")) {
      tokens.push({
        type: "strong",
        children: parseInlineTokens(tok.slice(2, -2)),
      })
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      tokens.push({ type: "em", children: parseInlineTokens(tok.slice(1, -1)) })
    } else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      const label = lm?.[1] ?? tok
      const href = lm?.[2] ?? ""
      const safe = /^https?:\/\//i.test(href) || href.startsWith("/")
      tokens.push(
        safe
          ? { type: "link", value: label, href }
          : { type: "text", value: label },
      )
    }
    rest = rest.slice(m.index + tok.length)
  }
  return tokens
}

const SPECIAL_LINE = /^(#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s?|```)/

/**
 * Parse a markdown document into a flat list of block descriptors. Supports
 * ATX headings (#/##/###), unordered (-/*) and ordered (1.) lists,
 * blockquotes, fenced code blocks and blank-line-separated paragraphs.
 */
export function parseMarkdown(src: string): MdBlock[] {
  const lines = (src ?? "").replace(/\r\n/g, "\n").split("\n")
  const blocks: MdBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ""
    if (line.trim() === "") {
      i++
      continue
    }
    if (line.trimStart().startsWith("```")) {
      const code: string[] = []
      i++
      while (
        i < lines.length &&
        !(lines[i] ?? "").trimStart().startsWith("```")
      ) {
        code.push(lines[i] ?? "")
        i++
      }
      i++
      blocks.push({ type: "code", value: code.join("\n") })
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = Math.min(3, (h[1] ?? "#").length) as 1 | 2 | 3
      blocks.push({
        type: "heading",
        level,
        inline: parseInlineTokens(h[2] ?? ""),
      })
      i++
      continue
    }
    if (/^>\s?/.test(line)) {
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        q.push((lines[i] ?? "").replace(/^>\s?/, ""))
        i++
      }
      blocks.push({ type: "quote", inline: parseInlineTokens(q.join(" ")) })
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? "")) {
        items.push(parseInlineTokens((lines[i] ?? "").replace(/^[-*]\s+/, "")))
        i++
      }
      blocks.push({ type: "ul", items })
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: InlineToken[][] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? "")) {
        items.push(parseInlineTokens((lines[i] ?? "").replace(/^\d+\.\s+/, "")))
        i++
      }
      blocks.push({ type: "ol", items })
      continue
    }
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i] ?? ""
      if (l.trim() === "" || SPECIAL_LINE.test(l)) break
      para.push(l)
      i++
    }
    blocks.push({
      type: "paragraph",
      inline: parseInlineTokens(para.join(" ")),
    })
  }
  return blocks
}

function renderInline(tokens: InlineToken[], keyBase: string): ReactNode[] {
  return tokens.map((t, idx) => {
    const key = `${keyBase}-${idx}`
    switch (t.type) {
      case "text":
        return <span key={key}>{t.value}</span>
      case "code":
        return (
          <code key={key} className="md-code">
            {t.value}
          </code>
        )
      case "strong":
        return <strong key={key}>{renderInline(t.children, key)}</strong>
      case "em":
        return <em key={key}>{renderInline(t.children, key)}</em>
      case "link":
        return (
          <a key={key} href={t.href} target="_blank" rel="noopener noreferrer">
            {t.value}
          </a>
        )
    }
  })
}

function renderBlock(block: MdBlock, key: string): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = (["h3", "h4", "h5"][block.level - 1] ?? "h4") as
        | "h3"
        | "h4"
        | "h5"
      return (
        <Tag key={key} className={`md-h${block.level}`}>
          {renderInline(block.inline, key)}
        </Tag>
      )
    }
    case "paragraph":
      return (
        <p key={key} className="md-p">
          {renderInline(block.inline, key)}
        </p>
      )
    case "ul":
      return (
        <ul key={key} className="md-ul">
          {block.items.map((it, idx) => (
            <li key={`${key}-${idx}`}>{renderInline(it, `${key}-${idx}`)}</li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol key={key} className="md-ol">
          {block.items.map((it, idx) => (
            <li key={`${key}-${idx}`}>{renderInline(it, `${key}-${idx}`)}</li>
          ))}
        </ol>
      )
    case "quote":
      return (
        <blockquote key={key} className="md-quote">
          {renderInline(block.inline, key)}
        </blockquote>
      )
    case "code":
      return (
        <pre key={key} className="md-pre">
          <code>{block.value}</code>
        </pre>
      )
  }
}

interface MarkdownProps {
  source: string | null | undefined
  className?: string
}

/**
 * Render a markdown string as React nodes using a dependency-free parser.
 * No raw HTML is ever injected (no dangerouslySetInnerHTML), so user content
 * cannot inject markup. Returns null for empty input.
 */
export function Markdown({ source, className }: MarkdownProps) {
  const blocks = parseMarkdown(source ?? "")
  if (blocks.length === 0) return null
  return (
    <div className={className ? `md ${className}` : "md"}>
      {blocks.map((b, idx) => renderBlock(b, `b${idx}`))}
    </div>
  )
}
