import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findMany: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const rateCheck = vi.fn()
vi.mock("@/lib/mcp/rate-limit", () => ({
  mcpRateLimiter: { check: (principal: string) => rateCheck(principal) },
}))

const recordMcpToolCall = vi.fn()
vi.mock("@/lib/mcp/audit", () => ({
  recordMcpToolCall: (entry: unknown) => recordMcpToolCall(entry),
  withMcpAudit: (_context: unknown, execute: () => Promise<unknown>) =>
    execute(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

const APP_URL = "https://freelance-manager.example.test"
const TOKEN = "9c2b4a6f8e0d1c3b5a3f7a1c9d2e4b6a8c0f1e3d5c7b9a2f4e6d8c0b1a3f5e7d"
const HASH = createHash("sha256").update(TOKEN, "utf8").digest("hex")

const INITIALIZE_BODY = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  },
})

function mcpRequest(options: {
  token?: string
  origin?: string
  body?: string
}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  }
  if (options.token) headers.authorization = `Bearer ${options.token}`
  if (options.origin) headers.origin = options.origin
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers,
    body: options.body ?? INITIALIZE_BODY,
  })
}

describe("POST /mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MCP_TOKEN_HASH", HASH)
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL)
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }])
    rateCheck.mockReturnValue({ allowed: true, retryAfterMs: 0 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects a cross-site Origin with 403 before touching auth", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      mcpRequest({ token: TOKEN, origin: "https://evil.example.com" }),
    )
    expect(res.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    const body = (await res.json()) as { error: { message: string } }
    expect(body.error.message).toBe("Forbidden")
  })

  it("accepts the app's own Origin", async () => {
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: TOKEN, origin: APP_URL }))
    expect(res.status).toBe(200)
  })

  it("returns 503 without detail when MCP_TOKEN_HASH is unset", async () => {
    vi.stubEnv("MCP_TOKEN_HASH", "")
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: TOKEN }))
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(HASH)
    expect(text).not.toContain("MCP_TOKEN_HASH")
  })

  it("returns 401 with no detail when the token is missing", async () => {
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({}))
    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe("Bearer")
    const text = await res.text()
    expect(text).not.toContain(HASH)
    expect(
      (JSON.parse(text) as { error: { message: string } }).error.message,
    ).toBe("Unauthorized")
  })

  it("returns 401 for a wrong token without leaking the hash", async () => {
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: "wrong-token" }))
    expect(res.status).toBe(401)
    const text = await res.text()
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(HASH)
  })

  it("returns a JSON-RPC 429 and audits the rejection when rate limited", async () => {
    rateCheck.mockReturnValue({ allowed: false, retryAfterMs: 5000 })
    const { POST } = await import("./route")
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "list_clients", arguments: {} },
    })
    const res = await POST(mcpRequest({ token: TOKEN, body }))
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("5")
    const payload = (await res.json()) as {
      id: number
      error: { message: string }
    }
    expect(payload.id).toBe(7)
    expect(payload.error.message).toBe("Rate limit exceeded")
    expect(recordMcpToolCall).toHaveBeenCalledWith({
      userId: "user-1",
      tool: "tools/call:list_clients",
      args: null,
      outcome: "rate_limited",
      durationMs: 0,
    })
  })

  it("still returns 429 when the rate-limit audit write fails", async () => {
    rateCheck.mockReturnValue({ allowed: false, retryAfterMs: 1000 })
    recordMcpToolCall.mockRejectedValue(new Error("db down"))
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: TOKEN }))
    expect(res.status).toBe(429)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it("serves a stateless initialize response for a valid token", async () => {
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: TOKEN }))
    expect(res.status).toBe(200)
    expect(res.headers.get("mcp-session-id")).toBeNull()
    expect(rateCheck).toHaveBeenCalledWith("user-1")
    const payload = (await res.json()) as {
      result: { serverInfo: { name: string } }
    }
    expect(payload.result.serverInfo.name).toBe("freelance-manager")
  })

  it("lists the registered v1 tools for a valid token", async () => {
    const { POST } = await import("./route")
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {},
    })
    const res = await POST(mcpRequest({ token: TOKEN, body }))
    expect(res.status).toBe(200)
    const payload = (await res.json()) as {
      result: {
        tools: {
          name: string
          annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
        }[]
      }
    }
    const names = payload.result.tools.map((t) => t.name)
    expect(names).toHaveLength(16)
    expect(names).toContain("list_clients")
    expect(names).toContain("create_invoice_draft")
    const draft = payload.result.tools.find(
      (t) => t.name === "create_invoice_draft",
    )
    expect(draft?.annotations?.readOnlyHint).toBe(false)
    expect(draft?.annotations?.destructiveHint).toBe(false)
  })

  it("never leaks the token or hash in a successful response", async () => {
    const { POST } = await import("./route")
    const res = await POST(mcpRequest({ token: TOKEN }))
    const text = await res.text()
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(HASH)
  })

  it("responds 405 to GET (no SSE stream offered)", async () => {
    const { GET } = await import("./route")
    const res = GET()
    expect(res.status).toBe(405)
    expect(res.headers.get("allow")).toBe("POST")
  })

  it("responds 405 to DELETE (no sessions to terminate)", async () => {
    const { DELETE } = await import("./route")
    const res = DELETE()
    expect(res.status).toBe(405)
    expect(res.headers.get("allow")).toBe("POST")
  })
})
