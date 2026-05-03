import { z } from "zod/v4"

/**
 * Query string contract for keyset-paginated list endpoints.
 *
 * - `cursor` — opaque ID of the last row from the previous page (or undefined
 *   for the first page). Implementations pass it to Prisma's
 *   `cursor: { id }` + `skip: 1`.
 * - `limit` — page size, defaults to 50, capped at 100 to bound payload size.
 */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type PaginationQuery = z.infer<typeof paginationQuerySchema>

export interface PaginatedResponse<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
}
