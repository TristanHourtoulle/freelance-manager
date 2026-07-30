import "server-only"
import { z } from "zod/v4"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import { withMcpAudit } from "@/lib/mcp/audit"
import { buildPagedResponse } from "@/lib/api"

export const NAME_MAX_CHARS = 120
export const TITLE_MAX_CHARS = 200
export const LABEL_MAX_CHARS = 240
export const NOTE_MAX_CHARS = 500
export const LIST_LIMIT_MAX = 50
export const LIST_LIMIT_DEFAULT = 25

/**
 * Sentence appended to every list tool description so the model never
 * mistakes one capped page for the full dataset.
 */
export const CAPPED_LIST_NOTE =
  "Results are paginated and CAPPED at 50 rows per call — one page is never the full dataset; pass the returned nextCursor as cursor to fetch more."

/**
 * Annotations shared by every read tool: pure reads of the user's own data.
 */
export const READ_ONLY_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

/**
 * Annotations for non-destructive writes; pass `idempotent` per tool.
 *
 * @param idempotent - Whether repeating the same call leaves the same state.
 * @returns The annotations object for `registerTool`.
 */
export function writeAnnotations(idempotent: boolean): ToolAnnotations {
  return {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: idempotent,
    openWorldHint: false,
  }
}

/**
 * Domain-level tool failure surfaced to the model as an `isError` result
 * (SEP-1303) instead of a protocol error, so it can self-correct.
 */
export class McpToolError extends Error {
  /**
   * Optional machine-readable payload carried alongside the human-readable
   * message, surfaced on the result's `structuredContent` (e.g. a refusal
   * that needs a typed `retryAfterSeconds` or `runId`, not just prose).
   */
  readonly structured?: Record<string, unknown>

  constructor(message: string, structured?: Record<string, unknown>) {
    super(message)
    this.name = "McpToolError"
    this.structured = structured
  }
}

/**
 * Uniform not-found failure that never distinguishes "does not exist" from
 * "belongs to another user".
 *
 * @param resource - Human-readable resource name, e.g. "Client".
 * @returns The error to throw from a tool handler.
 */
export function mcpNotFound(resource: string): McpToolError {
  return new McpToolError(`${resource} not found`)
}

/**
 * Truncate a free-text value to a maximum number of characters, appending an
 * ellipsis when content was dropped.
 *
 * @param value - The raw text.
 * @param maxChars - Maximum characters to keep.
 * @returns The bounded text.
 */
export function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars)}…`
}

/**
 * Nullable-aware variant of {@link truncateText}.
 *
 * @param value - The raw text, possibly absent.
 * @param maxChars - Maximum characters to keep.
 * @returns The bounded text, or null when absent.
 */
export function truncateNullableText(
  value: string | null | undefined,
  maxChars: number,
): string | null {
  if (value == null) return null
  return truncateText(value, maxChars)
}

/**
 * Wrap structured tool output in a spec-compliant result, mirroring the
 * structured content as a JSON text block for older clients.
 *
 * @param structured - The payload matching the tool's declared outputSchema.
 * @returns The CallToolResult to hand back to the SDK.
 */
export function structuredResult(
  structured: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  }
}

/**
 * Build an `isError` tool result carrying a plain-text message and, when
 * given, a typed `structuredContent` payload the model can read fields off
 * of instead of parsing prose (e.g. `retryAfterSeconds`, `runId`).
 *
 * @param message - The message the model may use to self-correct.
 * @param structured - Optional machine-readable payload for this refusal.
 * @returns The error-shaped CallToolResult.
 */
export function errorResult(
  message: string,
  structured?: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    ...(structured ? { structuredContent: structured } : {}),
    isError: true,
  }
}

/**
 * Execute a tool handler with mandatory auditing and error containment.
 *
 * Every call — success or failure — produces an ActivityLog row via
 * `withMcpAudit`. Domain failures (`McpToolError`) become `isError` tool
 * results so the model can self-correct; unexpected errors are logged
 * server-side and collapse to an opaque "Internal error" result that never
 * leaks internals.
 *
 * @param context - Principal, tool name and raw arguments of the call.
 * @param execute - The handler producing the structured output.
 * @returns The structured result, or an `isError` result.
 */
export async function runMcpTool<T extends Record<string, unknown>>(
  context: { userId: string; tool: string; args: unknown },
  execute: () => Promise<T>,
): Promise<CallToolResult> {
  try {
    return structuredResult(await withMcpAudit(context, execute))
  } catch (err) {
    if (err instanceof McpToolError) {
      return errorResult(err.message, err.structured)
    }
    console.error(`[mcp] tool ${context.tool} failed`, err)
    return errorResult("Internal error")
  }
}

/**
 * Cursor input accepted by every paginated read tool.
 */
export const cursorInputSchema = z
  .string()
  .min(1)
  .optional()
  .describe("Opaque cursor from the previous page's nextCursor")

/**
 * Bounded page-size input shared by every paginated read tool.
 */
export const limitInputSchema = z
  .number()
  .int()
  .min(1)
  .max(LIST_LIMIT_MAX)
  .default(LIST_LIMIT_DEFAULT)
  .describe("Page size, capped at 50")

/**
 * Date input accepted by write tools: an ISO date or datetime string.
 */
export const isoDateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")

/**
 * Parse an ISO date string already shaped by {@link isoDateInputSchema} into
 * a Date, failing as a domain error the model can correct.
 *
 * @param value - The ISO date or datetime string.
 * @param field - Field name used in the error message.
 * @returns The parsed Date.
 * @throws McpToolError when the string is not a real date.
 */
export function parseIsoDate(value: string, field: string): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new McpToolError(`Invalid date for ${field}: ${value}`)
  }
  return parsed
}

/**
 * Output shape shared by every paginated list tool.
 *
 * @param item - Schema of one row.
 * @returns The zod object for the tool's outputSchema.
 */
export function pagedOutputSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z
      .string()
      .nullable()
      .describe("Pass as cursor to fetch the next page"),
    hasMore: z.boolean(),
  })
}

/**
 * Hard server-side cap on how many rows `runPaginatedQuery` will walk when
 * `fetchAll` is set, regardless of how large `total` turns out to be. Chosen
 * well above any real list size in this single-user app (194 tasks was the
 * case that motivated the whole v2 contract) while still bounding one MCP
 * call to a bounded number of DB round trips.
 */
export const FETCH_ALL_SAFETY_CAP = 1000

/**
 * Sentence appended to a list tool's description once it adopts the v2
 * pagination contract (`total` + `fetchAll`), replacing {@link CAPPED_LIST_NOTE}.
 */
export const PAGINATED_LIST_NOTE =
  `Results are paginated, capped at 50 rows per call. \`total\` is the ` +
  `UNCAPPED count of every row matching the filters — always trust it over ` +
  `the number of rows returned. Pass \`nextCursor\` as \`cursor\` to fetch ` +
  `the next page, or set \`fetchAll: true\` to auto-follow every page ` +
  `server-side (up to a hard safety cap of ${FETCH_ALL_SAFETY_CAP} rows). ` +
  `Check \`truncated\`: when true the safety cap was hit and \`data\` is a ` +
  `partial prefix, never the complete result — never treat it as such.`

/**
 * Opt-in auto-follow flag accepted by every v2 paginated read tool.
 */
export const fetchAllInputSchema = z
  .boolean()
  .default(false)
  .describe(
    `Auto-follow every page server-side up to a hard safety cap of ` +
      `${FETCH_ALL_SAFETY_CAP} rows, instead of returning one page. Check ` +
      `the response's \`truncated\` field: true means the cap was hit and ` +
      `the result is not the complete set.`,
  )

/**
 * Output shape shared by every list tool on the v2 pagination contract: one
 * page of rows plus an uncapped `total` and a `truncated` flag that is only
 * ever true when `fetchAll` stopped early at the safety cap.
 *
 * @param item - Schema of one row.
 * @returns The zod object for the tool's outputSchema.
 */
export function paginatedOutputSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    nextCursor: z
      .string()
      .nullable()
      .describe("Pass as cursor to fetch the next page"),
    hasMore: z.boolean(),
    total: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "Uncapped count of every row matching the filters, independent of " +
          "page size — always the true size of the full result set, never " +
          "just this page's length.",
      ),
    truncated: z
      .boolean()
      .describe(
        "True only when fetchAll stopped at the safety cap before " +
          "exhausting the result set; data is then a partial prefix, not " +
          "the complete set.",
      ),
  })
}

/**
 * Pagination arguments accepted by `runPaginatedQuery`: the validated
 * `cursor`/`limit`/`fetchAll` a v2 list tool parses out of its own zod
 * input (which typically also carries tool-specific filters).
 */
export interface PaginationArgs {
  cursor?: string
  limit: number
  fetchAll?: boolean
}

interface RunPaginatedQueryOptions<T extends { id: string }> {
  /** Validated cursor/limit/fetchAll for this call. */
  args: PaginationArgs
  /**
   * Real DB `count()` over the same filters as `page` — never derived from
   * `rows.length`. Called exactly once regardless of `fetchAll`.
   */
  count: () => Promise<number>
  /**
   * One page of rows ordered by a stable, unique-terminated key (so cursor
   * pagination cannot skip or repeat rows). Must honor `take` as
   * `limit + 1` semantics: the caller passes `take` already inflated by one
   * so `runPaginatedQuery` can detect `hasMore` — see `buildPagedResponse`.
   */
  page: (params: { cursor?: string; take: number }) => Promise<T[]>
  /** Overrides {@link FETCH_ALL_SAFETY_CAP}, for tests. */
  safetyCap?: number
}

/**
 * Result shape of `runPaginatedQuery`, matching {@link paginatedOutputSchema}
 * minus the caller's own row projection (callers map `data` to their
 * output row shape after calling this).
 */
export interface PaginatedQueryResult<T> {
  data: T[]
  nextCursor: string | null
  hasMore: boolean
  total: number
  truncated: boolean
}

/**
 * Shared orchestration for the v2 pagination contract: one real `count()`
 * plus either a single page, or — when `args.fetchAll` is set — every page
 * walked server-side up to a hard safety cap.
 *
 * `total` always comes from `count`, never from summing fetched rows, so it
 * stays correct even when `fetchAll` stops early. Auto-follow never returns
 * a partial result silently: it is only ever "not truncated" when the walk
 * reached a page whose own `hasMore` is false, i.e. the underlying query
 * confirmed there is nothing left — never because the cap and the true end
 * happened to line up by coincidence of counting.
 *
 * @param options - The pagination args, count query and page query.
 * @returns One page (or the full walked set) plus `total` and `truncated`.
 */
export async function runPaginatedQuery<T extends { id: string }>(
  options: RunPaginatedQueryOptions<T>,
): Promise<PaginatedQueryResult<T>> {
  const { args, count, page } = options
  const safetyCap = options.safetyCap ?? FETCH_ALL_SAFETY_CAP
  const total = await count()

  if (!args.fetchAll) {
    const rows = await page({ cursor: args.cursor, take: args.limit + 1 })
    const paged = buildPagedResponse(rows, args.limit)
    return {
      data: paged.data,
      nextCursor: paged.nextCursor,
      hasMore: paged.hasMore,
      total,
      truncated: false,
    }
  }

  const data: T[] = []
  let cursor = args.cursor
  let hasMore = false

  while (data.length < safetyCap) {
    const take = Math.min(args.limit, safetyCap - data.length)
    const rows = await page({ cursor, take: take + 1 })
    const paged = buildPagedResponse(rows, take)
    data.push(...paged.data)
    hasMore = paged.hasMore
    cursor = paged.nextCursor ?? undefined
    if (!hasMore) break
  }

  const truncated = hasMore && data.length >= safetyCap
  return {
    data,
    nextCursor: truncated ? (cursor ?? null) : null,
    hasMore: truncated,
    total,
    truncated,
  }
}
