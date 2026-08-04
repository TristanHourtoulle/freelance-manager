import { describe, expect, it, vi } from "vitest"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js"

vi.mock("@/lib/db", () => ({ prisma: {} }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

import { registerMcpTools } from "./index"

const READ_TOOLS = [
  "list_clients",
  "get_client",
  "list_projects",
  "list_tasks",
  "list_task_groups",
  "list_invoices",
  "get_invoice",
  "list_quotes",
  "get_dashboard",
  "get_analytics",
  "list_meetings",
  "list_actions",
  "get_linear_sync_status",
] as const

const WRITE_TOOLS = [
  "create_client",
  "update_client",
  "link_linear_project",
  "create_invoice_draft",
  "update_invoice_draft",
  "split_invoice",
  "record_payment",
  "set_task_actual_days",
  "set_task_estimate",
  "set_task_billability",
  "create_task_group",
  "update_task_group",
  "log_meeting",
  "update_meeting",
  "create_action",
  "complete_action",
  "trigger_linear_sync",
] as const

const DESTRUCTIVE_TOOLS = ["delete_meeting", "delete_task_group"] as const

/**
 * Tools whose name legitimately contains a word the blanket guard below
 * forbids everywhere else. Each entry here must be justified the same way
 * `DESTRUCTIVE_TOOLS` is: an explicit, reviewed exception, not a loophole.
 * - `record_payment` genuinely moves money.
 * - `trigger_linear_sync` / `get_linear_sync_status` genuinely trigger and
 *   report on a Linear sync — the pull-only, non-destructive, rate-limited
 *   exception carved out from the "nothing can sync" boundary this guard
 *   otherwise enforces.
 */
const NAME_GUARD_EXCEPTIONS = [
  "record_payment",
  "trigger_linear_sync",
  "get_linear_sync_status",
] as const

interface RegisteredToolConfig {
  description: string
  annotations: ToolAnnotations
}

function registerAll(): Map<string, RegisteredToolConfig> {
  const registered = new Map<string, RegisteredToolConfig>()
  const fakeServer = {
    registerTool: (name: string, config: RegisteredToolConfig) => {
      registered.set(name, config)
    },
  } as unknown as McpServer
  registerMcpTools(fakeServer, "user-1")
  return registered
}

describe("registerMcpTools", () => {
  it("registers exactly the v1 tool surface", () => {
    const registered = registerAll()
    expect([...registered.keys()].sort()).toEqual(
      [...READ_TOOLS, ...WRITE_TOOLS, ...DESTRUCTIVE_TOOLS].sort(),
    )
  })

  it("annotates every read tool as read-only and non-destructive", () => {
    const registered = registerAll()
    for (const name of READ_TOOLS) {
      const config = registered.get(name)
      expect(config, name).toBeDefined()
      expect(config!.annotations.readOnlyHint, name).toBe(true)
      expect(config!.annotations.destructiveHint, name).toBe(false)
    }
  })

  it("annotates every write tool as non-read-only and non-destructive", () => {
    const registered = registerAll()
    for (const name of WRITE_TOOLS) {
      const config = registered.get(name)
      expect(config, name).toBeDefined()
      expect(config!.annotations.readOnlyHint, name).toBe(false)
      expect(config!.annotations.destructiveHint, name).toBe(false)
    }
  })

  it("annotates only the explicitly reviewed delete tools as destructive", () => {
    const registered = registerAll()
    for (const name of DESTRUCTIVE_TOOLS) {
      const config = registered.get(name)
      expect(config, name).toBeDefined()
      expect(config!.annotations.readOnlyHint, name).toBe(false)
      expect(config!.annotations.destructiveHint, name).toBe(true)
    }
    const destructive = [...registered.entries()].filter(
      ([, config]) => config.annotations.destructiveHint,
    )
    expect(destructive.map(([name]) => name).sort()).toEqual(
      [...DESTRUCTIVE_TOOLS].sort(),
    )
  })

  it("tells the model that every list result is capped", () => {
    const registered = registerAll()
    const listTools = [...READ_TOOLS].filter((n) => n.startsWith("list_"))
    for (const name of listTools) {
      expect(registered.get(name)!.description, name).toMatch(/capped/i)
    }
  })

  it("exposes no tool able to send, delete, cancel, sync or touch settings/tokens — only the explicitly reviewed exceptions may pay or delete", () => {
    const registered = registerAll()
    for (const name of registered.keys()) {
      if ((DESTRUCTIVE_TOOLS as readonly string[]).includes(name)) continue
      if ((NAME_GUARD_EXCEPTIONS as readonly string[]).includes(name)) continue
      expect(name).not.toMatch(
        /send|pay|delete|cancel|sync|settings|token|email/,
      )
    }
  })
})
