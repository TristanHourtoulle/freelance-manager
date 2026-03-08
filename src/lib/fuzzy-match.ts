interface FuzzyMatchResult {
  isMatch: boolean
  score: number
}

/**
 * Performs a fuzzy match of a query string against a target string.
 * Scores exact substring matches higher, then falls back to character-by-character matching.
 *
 * @param query - The search query
 * @param target - The string to match against
 * @returns Match result with `isMatch` flag and a relevance `score`
 *
 * @example
 * ```ts
 * fuzzyMatch("cli", "ClientCard") // => { isMatch: true, score: 130 }
 * fuzzyMatch("xyz", "ClientCard") // => { isMatch: false, score: 0 }
 * ```
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
  if (query.length === 0) {
    return { isMatch: true, score: 0 }
  }

  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()

  if (lowerTarget.includes(lowerQuery)) {
    const index = lowerTarget.indexOf(lowerQuery)
    const score = 100 - index + (lowerQuery.length / lowerTarget.length) * 50
    return { isMatch: true, score }
  }

  let queryIndex = 0
  let score = 0
  let consecutive = 0

  for (
    let i = 0;
    i < lowerTarget.length && queryIndex < lowerQuery.length;
    i++
  ) {
    if (lowerTarget[i] === lowerQuery[queryIndex]) {
      queryIndex++
      consecutive++
      score += consecutive * 2 + (i < 3 ? 5 : 0)
    } else {
      consecutive = 0
    }
  }

  if (queryIndex < lowerQuery.length) {
    return { isMatch: false, score: 0 }
  }

  return { isMatch: true, score }
}

/**
 * Filters and sorts an array of items by fuzzy matching against a key.
 * Returns all matching items sorted by descending relevance score.
 *
 * @param query - The search query (returns all items if empty)
 * @param items - The items to filter
 * @param getKey - Function to extract the searchable string from each item
 * @returns Filtered and sorted items
 *
 * @example
 * ```ts
 * fuzzyFilter("acme", clients, (c) => c.name)
 * ```
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getKey: (item: T) => string,
): T[] {
  if (query.length === 0) {
    return items
  }

  const scored = items
    .map((item) => ({ item, result: fuzzyMatch(query, getKey(item)) }))
    .filter(({ result }) => result.isMatch)
    .sort((a, b) => b.result.score - a.result.score)

  return scored.map(({ item }) => item)
}
