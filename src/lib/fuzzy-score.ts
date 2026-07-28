/**
 * Scores how well a query fuzzy-matches a text, higher is better.
 *
 * Exact substring hits score highest (earlier hits above later ones), then a
 * subsequence scan rewards consecutive-character streaks. A score of 0 means
 * no match. Shared by the command palette and the filter combobox.
 *
 * @param text - The haystack to score against.
 * @param q - The user query; an empty query matches everything with score 1.
 * @returns A positive score when the query matches, 0 otherwise.
 */
export function fuzzyScore(text: string, q: string): number {
  if (!q) return 1
  const lt = text.toLowerCase()
  const lq = q.toLowerCase()
  if (lt.includes(lq)) return 100 - lt.indexOf(lq)
  let ti = 0,
    qi = 0,
    score = 0,
    streak = 0
  while (ti < lt.length && qi < lq.length) {
    if (lt[ti] === lq[qi]) {
      qi++
      streak++
      score += 1 + streak
    } else {
      streak = 0
    }
    ti++
  }
  return qi === lq.length ? score : 0
}

/**
 * Lowercases a string and strips diacritics so French labels match their
 * unaccented spellings ("Émilie" matches "emilie").
 *
 * @param text - The raw label or query.
 * @returns The normalized, accent-free, lowercase string.
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}
