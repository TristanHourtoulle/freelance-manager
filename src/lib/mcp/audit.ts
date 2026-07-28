import "server-only"
import { prisma } from "@/lib/db"

const ARGS_MAX_CHARS = 2_000

export type McpToolOutcome = "success" | "error" | "rate_limited"

export interface McpAuditEntry {
  userId: string
  tool: string
  args: unknown
  outcome: McpToolOutcome
  durationMs: number
}

const OUTCOME_LABELS: Record<McpToolOutcome, string> = {
  success: "succès",
  error: "erreur",
  rate_limited: "limité",
}

/**
 * Write one MCP audit row to ActivityLog.
 *
 * Unlike `deferActivityLog`, this write is AWAITED, not deferred via
 * `after()`: MCP calls are issued by an autonomous agent, and the audit
 * trail is the security control that makes those calls attributable and
 * reviewable. A best-effort deferred write can silently drop records, so
 * here a failed audit write propagates to the caller — fail closed. The
 * arguments are serialized and capped at 2 000 chars; the bearer token
 * never reaches this layer and is never part of the row.
 *
 * @param entry - Principal, tool name, raw arguments, outcome and duration.
 * @throws When the underlying ActivityLog insert fails.
 */
export async function recordMcpToolCall(entry: McpAuditEntry): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: entry.userId,
      kind: "MCP_TOOL_CALL",
      title: `Appel MCP ${entry.tool} (${OUTCOME_LABELS[entry.outcome]})`,
      meta: JSON.stringify({
        tool: entry.tool,
        outcome: entry.outcome,
        durationMs: entry.durationMs,
        args: serializeArgs(entry.args),
      }),
    },
  })
}

/**
 * Execute a tool handler with mandatory auditing.
 *
 * On success the audit row is awaited BEFORE the result is returned; if
 * that write fails the whole call fails, so no successful action can go
 * unrecorded. On handler failure the audit row is attempted best-effort
 * (a second failure is logged to console and the ORIGINAL error is
 * rethrown — the call already failed, so nothing unaudited happened).
 *
 * @param context - Principal, tool name and raw arguments of the call.
 * @param execute - The tool handler to run.
 * @returns The handler's result once its audit row is persisted.
 * @throws The handler's error, or the audit error for a successful call.
 */
export async function withMcpAudit<T>(
  context: { userId: string; tool: string; args: unknown },
  execute: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  try {
    const result = await execute()
    await recordMcpToolCall({
      ...context,
      outcome: "success",
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (err) {
    try {
      await recordMcpToolCall({
        ...context,
        outcome: "error",
        durationMs: Date.now() - startedAt,
      })
    } catch (auditErr) {
      console.error("[mcp] audit write failed for errored call", auditErr)
    }
    throw err
  }
}

function serializeArgs(args: unknown): string {
  let serialized: string
  try {
    serialized = JSON.stringify(args) ?? "undefined"
  } catch {
    serialized = "[unserializable]"
  }
  if (serialized.length <= ARGS_MAX_CHARS) return serialized
  return `${serialized.slice(0, ARGS_MAX_CHARS)}…[truncated]`
}
