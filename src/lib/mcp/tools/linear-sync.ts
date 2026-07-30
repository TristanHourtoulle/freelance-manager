import "server-only"
import { z } from "zod/v4"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { prisma } from "@/lib/db"
import { triggerLinearSync } from "@/lib/linear-sync-trigger"
import {
  McpToolError,
  READ_ONLY_ANNOTATIONS,
  runMcpTool,
  writeAnnotations,
} from "@/lib/mcp/tools/common"

/**
 * Minimum time between two `trigger_linear_sync` calls for the same user,
 * counted from the `startedAt` of their most recent sync run (of any
 * status). Distinct from — and layered on top of — the single-flight guard
 * in `triggerLinearSync`, which refuses a concurrent call outright rather
 * than asking it to wait.
 */
export const TRIGGER_COOLDOWN_MS = 60_000

const triggerLinearSyncInput = z.object({})

const triggerLinearSyncOutput = z.object({
  status: z.literal("started"),
  runId: z.string().describe("Pass to get_linear_sync_status to poll"),
  statusTool: z.literal("get_linear_sync_status"),
  expectedDuration: z.string(),
  nextTriggerAllowedAt: z
    .string()
    .describe("ISO timestamp; trigger_linear_sync refuses before this time"),
})

const getLinearSyncStatusInput = z.object({})

const syncRunStatusSchema = z.enum(["RUNNING", "COMPLETED", "FAILED"])

const getLinearSyncStatusOutput = z.object({
  status: z.union([z.literal("idle"), syncRunStatusSchema]),
  runId: z.string().nullable(),
  totalMappings: z.number().int().nullable(),
  doneMappings: z.number().int().nullable(),
  currentLabel: z.string().nullable(),
  projectsUpserted: z.number().int().nullable(),
  tasksUpserted: z.number().int().nullable(),
  errorMessage: z
    .string()
    .nullable()
    .describe("Set only when status is FAILED"),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
})

const SYNC_RUN_STATUS_SELECT = {
  id: true,
  status: true,
  totalMappings: true,
  doneMappings: true,
  currentLabel: true,
  projectsUpserted: true,
  tasksUpserted: true,
  errorMessage: true,
  startedAt: true,
  finishedAt: true,
} as const

/**
 * Handler for the trigger_linear_sync tool.
 *
 * Layers a 60s cooldown on top of {@link triggerLinearSync}'s own
 * single-flight guard, so the two refusal reasons stay distinguishable: a
 * currently `RUNNING` run always wins over the cooldown (checked first,
 * without even reading the age — a fresh or stale `RUNNING` row is left
 * entirely to `triggerLinearSync`'s own takeover logic), so the model is
 * never told to "wait N seconds" when the real remedy is to poll
 * `get_linear_sync_status` instead. The cooldown only applies when the most
 * recent run is NOT currently running (i.e. it already finished, or a
 * takeover would otherwise start a brand new one too soon after the last
 * attempt).
 *
 * @param userId - The resolved MCP principal.
 * @returns The started run's id and polling instructions, or an `isError`
 *   result with typed `structuredContent` distinguishing "already running"
 *   from "cooldown".
 */
export async function triggerLinearSyncTool(
  userId: string,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "trigger_linear_sync", args: {} },
    async () => {
      const now = Date.now()
      const latest = await prisma.linearSyncRun.findFirst({
        where: { userId },
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true },
      })

      if (latest && latest.status !== "RUNNING") {
        const ageMs = now - latest.startedAt.getTime()
        if (ageMs < TRIGGER_COOLDOWN_MS) {
          const retryAfterSeconds = Math.ceil(
            (TRIGGER_COOLDOWN_MS - ageMs) / 1000,
          )
          const nextTriggerAllowedAt = new Date(
            latest.startedAt.getTime() + TRIGGER_COOLDOWN_MS,
          ).toISOString()
          throw new McpToolError(
            `Cooldown active: retry trigger_linear_sync in ${retryAfterSeconds}s ` +
              `(minimum ${TRIGGER_COOLDOWN_MS / 1000}s between syncs).`,
            { status: "cooldown", retryAfterSeconds, nextTriggerAllowedAt },
          )
        }
      }

      const result = await triggerLinearSync(userId)
      if (result.status === "in_progress") {
        throw new McpToolError(
          result.runId
            ? `A Linear sync is already running (runId: ${result.runId}). ` +
              `Poll get_linear_sync_status with this runId until status is ` +
              `COMPLETED or FAILED — do not call trigger_linear_sync again.`
            : `A Linear sync is already running. Poll ` +
              `get_linear_sync_status until status is COMPLETED or FAILED.`,
          {
            status: "in_progress",
            runId: result.runId,
            statusTool: "get_linear_sync_status",
          },
        )
      }

      return {
        status: "started" as const,
        runId: result.runId,
        statusTool: "get_linear_sync_status" as const,
        expectedDuration:
          "Runs in the background and is not done when this call returns. " +
          "Typically finishes within a couple of minutes; a first sync or " +
          "one with many mappings can take longer. Poll " +
          "get_linear_sync_status for live progress (doneMappings/totalMappings).",
        nextTriggerAllowedAt: new Date(now + TRIGGER_COOLDOWN_MS).toISOString(),
      }
    },
  )
}

/**
 * Handler for the get_linear_sync_status tool: the latest `LinearSyncRun`
 * for this user, mirroring `GET /api/linear/sync-status`.
 *
 * @param userId - The resolved MCP principal.
 * @returns The latest run's status and progress, `errorMessage` when
 *   FAILED, or `{ status: "idle" }` when the user has never synced.
 */
export async function getLinearSyncStatus(
  userId: string,
): Promise<CallToolResult> {
  return runMcpTool(
    { userId, tool: "get_linear_sync_status", args: {} },
    async () => {
      const run = await prisma.linearSyncRun.findFirst({
        where: { userId },
        orderBy: { startedAt: "desc" },
        select: SYNC_RUN_STATUS_SELECT,
      })

      if (!run) {
        return {
          status: "idle" as const,
          runId: null,
          totalMappings: null,
          doneMappings: null,
          currentLabel: null,
          projectsUpserted: null,
          tasksUpserted: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
        }
      }

      return {
        status: run.status,
        runId: run.id,
        totalMappings: run.totalMappings,
        doneMappings: run.doneMappings,
        currentLabel: run.currentLabel,
        projectsUpserted: run.projectsUpserted,
        tasksUpserted: run.tasksUpserted,
        errorMessage: run.errorMessage,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      }
    },
  )
}

/**
 * Register the Linear sync trigger and status tools for one principal.
 *
 * @param server - The per-request McpServer instance.
 * @param userId - The resolved MCP principal.
 */
export function registerLinearSyncTools(
  server: McpServer,
  userId: string,
): void {
  server.registerTool(
    "trigger_linear_sync",
    {
      description:
        "Trigger a manual pull of Linear projects and tasks into this " +
        "app's mirror. NON-BLOCKING: returns immediately with a runId " +
        "once the sync has started in the background — the pull itself " +
        "is not done when this call returns, so poll " +
        "get_linear_sync_status with the returned runId instead of " +
        "calling this again. This is a write with an EXTERNAL side " +
        "effect (it reads from the Linear API) — not destructive, but " +
        "not idempotent while a sync is in flight. Refuses with an " +
        "isError result in two distinguishable cases (see " +
        "structuredContent.status): \"in_progress\" when a sync is " +
        "already running (carries the runId to poll), or \"cooldown\" " +
        "when the 60s minimum between syncs has not elapsed yet (carries " +
        "retryAfterSeconds and nextTriggerAllowedAt). Check syncStale on " +
        "list_tasks / list_projects / get_dashboard first — do not call " +
        "this speculatively on every read.",
      inputSchema: triggerLinearSyncInput,
      outputSchema: triggerLinearSyncOutput,
      annotations: writeAnnotations(false),
    },
    () => triggerLinearSyncTool(userId),
  )
  server.registerTool(
    "get_linear_sync_status",
    {
      description:
        "Get the status of the most recent Linear sync run for this " +
        "user: RUNNING (with live doneMappings/totalMappings progress), " +
        "COMPLETED, FAILED (with errorMessage), or idle when a sync has " +
        "never run. Use this to poll after trigger_linear_sync instead of " +
        "retrying the trigger.",
      inputSchema: getLinearSyncStatusInput,
      outputSchema: getLinearSyncStatusOutput,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    () => getLinearSyncStatus(userId),
  )
}
