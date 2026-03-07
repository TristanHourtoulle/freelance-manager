interface FuzzyMatchResult {
  isMatch: boolean
  score: number
}

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
