import { z } from "zod/v4"

/**
 * Upper bound for the `?q=` free-text search term accepted by the list
 * endpoints. Long enough for a full company name, short enough to keep the
 * generated `ILIKE` patterns cheap.
 */
export const MAX_SEARCH_QUERY_LENGTH = 120

/**
 * Query string contract for the optional free-text search supported by the
 * keyset-paginated list endpoints.
 *
 * The term is trimmed; a blank term is treated as absent so the endpoint keeps
 * its default (unfiltered) behavior.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(MAX_SEARCH_QUERY_LENGTH).optional(),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
