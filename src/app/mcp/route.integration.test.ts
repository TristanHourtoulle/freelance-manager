import { createHash } from "node:crypto"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import { makeClient, makeUser } from "@/test/integration/factories"

let ctx: IsolatedSchema

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

const APP_URL = "https://freelance-manager.integration.test"
const TOKEN = "9c2b4a6f8e0d1c3b5a3f7a1c9d2e4b6a8c0f1e3d5c7b9a2f4e6d8c0b1a3f5e7d"
const TOKEN_HASH = createHash("sha256").update(TOKEN, "utf8").digest("hex")

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "mcp")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  vi.stubEnv("MCP_TOKEN_HASH", TOKEN_HASH)
  vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function jsonRpcRequest(options: {
  token?: string
  origin?: string
  body: Record<string, unknown>
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
    body: JSON.stringify(options.body),
  })
}

const INITIALIZE_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "integration-test", version: "1.0.0" },
  },
}

function toolsListBody(id: number) {
  return { jsonrpc: "2.0", id, method: "tools/list", params: {} }
}

function toolsCallBody(id: number, name: string, args: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  }
}

interface JsonRpcErrorEnvelope {
  jsonrpc: "2.0"
  id: string | number | null
  error: { code: number; message: string }
}

interface ToolsListResult {
  jsonrpc: "2.0"
  id: number
  result: { tools: { name: string }[] }
}

interface ToolsCallResult {
  jsonrpc: "2.0"
  id: number
  result: {
    structuredContent?: {
      data?: { id: string; firstName: string; lastName: string }[]
    }
    isError?: boolean
  }
}

/**
 * Count the tools the app actually registers, by running the real
 * `registerMcpTools` against a fake, counting `McpServer`. Mirrors
 * `src/lib/mcp/tools/index.test.ts`'s technique, so the expected count in
 * this file is read from the code rather than hardcoded — a single
 * malformed tool schema breaking `tools/list` would show up as a mismatch
 * here instead of silently passing a stale hardcoded number.
 */
async function countRegisteredTools(): Promise<number> {
  const { registerMcpTools } = await import("@/lib/mcp/tools")
  const registered = new Set<string>()
  const fakeServer = {
    registerTool: (name: string) => {
      registered.add(name)
    },
  } as unknown as McpServer
  registerMcpTools(fakeServer, "probe-user")
  return registered.size
}

describe("POST /mcp (integration)", () => {
  it("returns 401 with no detail when no token is presented", async () => {
    const { POST } = await import("./route")
    const res = await POST(jsonRpcRequest({ body: INITIALIZE_BODY }))
    const text = await res.text()

    expect(res.status).toBe(401)
    expect(res.headers.get("www-authenticate")).toBe("Bearer")
    expect(text).not.toContain(TOKEN_HASH)
    const payload = JSON.parse(text) as JsonRpcErrorEnvelope
    expect(payload.error.message).toBe("Unauthorized")
  })

  it("returns 401 with no detail for a wrong token", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      jsonRpcRequest({ token: "wrong-token", body: INITIALIZE_BODY }),
    )
    const text = await res.text()

    expect(res.status).toBe(401)
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain(TOKEN_HASH)
  })

  it("rejects a cross-site Origin with 403 before ever touching the database", async () => {
    const { POST } = await import("./route")
    const res = await POST(
      jsonRpcRequest({
        token: TOKEN,
        origin: "https://evil.example.com",
        body: INITIALIZE_BODY,
      }),
    )

    expect(res.status).toBe(403)
  })

  it("fails closed with 503 when the workspace has zero users (no principal to resolve)", async () => {
    await ctx.prisma.user.deleteMany({})

    const { POST } = await import("./route")
    const res = await POST(jsonRpcRequest({ token: TOKEN, body: INITIALIZE_BODY }))

    expect(res.status).toBe(503)
  })

  it("fails closed with 503 when more than one user row exists (ambiguous principal)", async () => {
    await makeUser(ctx.prisma)
    await makeUser(ctx.prisma)

    const { POST } = await import("./route")
    const res = await POST(jsonRpcRequest({ token: TOKEN, body: INITIALIZE_BODY }))

    expect(res.status).toBe(503)
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

  describe("with a valid token and exactly one user", () => {
    it("lists the full, currently-registered tool surface — never a partial list", async () => {
      await makeUser(ctx.prisma)
      const expectedCount = await countRegisteredTools()

      const { POST } = await import("./route")
      const res = await POST(
        jsonRpcRequest({ token: TOKEN, body: toolsListBody(2) }),
      )
      const payload = (await res.json()) as ToolsListResult

      expect(res.status).toBe(200)
      const names = payload.result.tools.map((t) => t.name)
      expect(names).toHaveLength(expectedCount)
      expect(new Set(names).size).toBe(expectedCount)
      expect(names).toContain("list_clients")
    })

    it("resolves the single owner and scopes list_clients to real, owner-only data", async () => {
      const owner = await makeUser(ctx.prisma)
      const client = await makeClient(ctx.prisma, {
        userId: owner.id,
        firstName: "Ada",
        lastName: "Lovelace",
      })

      const { POST } = await import("./route")
      const res = await POST(
        jsonRpcRequest({
          token: TOKEN,
          body: toolsCallBody(3, "list_clients", {}),
        }),
      )
      const payload = (await res.json()) as ToolsCallResult

      expect(res.status).toBe(200)
      expect(payload.result.isError).toBeFalsy()
      const data = payload.result.structuredContent?.data ?? []
      expect(data).toHaveLength(1)
      expect(data[0]?.id).toBe(client.id)
      expect(data[0]?.firstName).toBe("Ada")

      const auditRow = await ctx.prisma.activityLog.findFirstOrThrow({
        where: { kind: "MCP_TOOL_CALL" },
      })
      expect(auditRow.userId).toBe(owner.id)
      expect(auditRow.title).toContain("list_clients")
    })

    it("never leaks the bearer token or its hash in a successful response", async () => {
      await makeUser(ctx.prisma)

      const { POST } = await import("./route")
      const res = await POST(
        jsonRpcRequest({ token: TOKEN, body: INITIALIZE_BODY }),
      )
      const text = await res.text()

      expect(res.status).toBe(200)
      expect(text).not.toContain(TOKEN)
      expect(text).not.toContain(TOKEN_HASH)
    })
  })
})
