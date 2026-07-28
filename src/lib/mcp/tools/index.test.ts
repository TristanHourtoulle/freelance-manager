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
  "list_invoices",
  "get_invoice",
  "list_quotes",
  "get_dashboard",
  "get_analytics",
  "list_meetings",
  "list_actions",
] as const

const WRITE_TOOLS = [
  "create_invoice_draft",
  "set_task_actual_days",
  "set_task_billability",
  "log_meeting",
  "create_action",
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
      [...READ_TOOLS, ...WRITE_TOOLS].sort(),
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

  it("tells the model that every list result is capped", () => {
    const registered = registerAll()
    const listTools = [...READ_TOOLS].filter((n) => n.startsWith("list_"))
    for (const name of listTools) {
      expect(registered.get(name)!.description, name).toContain("CAPPED")
    }
  })

  it("exposes no tool able to send, pay, delete, cancel, sync or touch settings", () => {
    const registered = registerAll()
    for (const name of registered.keys()) {
      expect(name).not.toMatch(
        /send|pay|delete|cancel|sync|settings|token|email/,
      )
    }
  })
})
