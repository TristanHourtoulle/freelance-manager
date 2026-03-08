/**
 * Formats a numeric amount as a EUR currency string using French locale.
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g. "1 500,00 €")
 *
 * @example
 * ```ts
 * formatCurrency(1500) // => "1 500,00 €"
 * ```
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

/**
 * Normalizes Linear markdown so that single newlines become paragraph breaks.
 * Preserves fenced code blocks, consecutive list items, consecutive table
 * rows, and already-blank lines.
 *
 * @param md - Raw markdown string from Linear
 * @returns Markdown with paragraph-break blank lines inserted between non-block lines
 */
export function normalizeLineBreaks(md: string): string {
  const lines = md.split("\n")
  const result: string[] = []
  let inCodeBlock = false

  const isBlockLine = (l: string) =>
    /^(\s*[-*+]\s|\s*\d+[.)]\s|\s*>|^\|)/.test(l)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string

    if (line.trimStart().startsWith("```")) {
      inCodeBlock = !inCodeBlock
      result.push(line)
      continue
    }

    if (inCodeBlock) {
      result.push(line)
      continue
    }

    result.push(line)

    const next = lines[i + 1] as string | undefined

    if (!line.trim() || next === undefined || !next.trim()) continue
    if (isBlockLine(line) && isBlockLine(next)) continue
    if (/^[-=]{3,}\s*$/.test(next)) continue

    result.push("")
  }

  return result.join("\n")
}
