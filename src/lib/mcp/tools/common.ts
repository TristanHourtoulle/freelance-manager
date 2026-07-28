import "server-only"
import { z } from "zod/v4"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"
import { withMcpAudit } from "@/lib/mcp/audit"

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
  constructor(message: string) {
    super(message)
    this.name = "McpToolError"
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
 * Build an `isError` tool result carrying a plain-text message.
 *
 * @param message - The message the model may use to self-correct.
 * @returns The error-shaped CallToolResult.
 */
export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
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
    if (err instanceof McpToolError) return errorResult(err.message)
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
