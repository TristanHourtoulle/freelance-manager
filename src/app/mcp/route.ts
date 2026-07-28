import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { authorizeMcpRequest } from "@/lib/mcp/auth"
import { validateMcpOrigin } from "@/lib/mcp/origin"
import { mcpRateLimiter } from "@/lib/mcp/rate-limit"
import { recordMcpToolCall } from "@/lib/mcp/audit"
import { registerMcpTools } from "@/lib/mcp/tools"

const SERVER_INFO = { name: "freelance-manager", version: "0.1.0" }

interface JsonRpcProbe {
  id: string | number | null
  tool: string
}

function jsonRpcError(
  status: number,
  message: string,
  options: {
    id?: string | number | null
    headers?: Record<string, string>
  } = {},
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message },
      id: options.id ?? null,
    },
    { status, headers: options.headers },
  )
}

async function probeJsonRpc(request: Request): Promise<JsonRpcProbe> {
  try {
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null) {
      return { id: null, tool: "unknown" }
    }
    const record = body as Record<string, unknown>
    const id =
      typeof record.id === "string" || typeof record.id === "number"
        ? record.id
        : null
    let tool = typeof record.method === "string" ? record.method : "unknown"
    if (
      tool === "tools/call" &&
      typeof record.params === "object" &&
      record.params !== null
    ) {
      const name = (record.params as Record<string, unknown>).name
      if (typeof name === "string") tool = `tools/call:${name}`
    }
    return { id, tool }
  } catch {
    return { id: null, tool: "unknown" }
  }
}

function buildServer(userId: string): McpServer {
  const server = new McpServer(SERVER_INFO)
  registerMcpTools(server, userId)
  return server
}

/**
 * Streamable HTTP MCP endpoint (stateless JSON mode, spec rev 2025-11-25).
 *
 * Lives at /mcp, deliberately outside /api/* so neither the session-cookie
 * edge proxy nor the /api/v1 rewrite applies; auth is the bearer token
 * checked here, not a browser session. Runs on the Node.js runtime — the
 * default for route handlers; the explicit `runtime` segment config is
 * rejected by `cacheComponents: true`, and this route must never be moved
 * to the edge runtime (node:crypto, Prisma). Request pipeline, each step failing
 * closed: Origin validation (absent = server-to-server, allowed; present =
 * exact NEXT_PUBLIC_APP_URL match) → constant-time bearer auth resolving
 * the single owner principal (503 unconfigured, 401 otherwise, bodies
 * carry no detail) → per-principal in-process rate limit (429, and the
 * rejection itself is audited to ActivityLog) → a fresh McpServer +
 * transport pair per request with `sessionIdGenerator: undefined` and
 * `enableJsonResponse: true`, so no session id is ever issued and every
 * POST gets a plain JSON reply. The v1 tool surface is registered per
 * request via `registerMcpTools`, scoped to the resolved principal; every
 * tool handler is wrapped in `withMcpAudit`.
 *
 * @param request - The incoming JSON-RPC POST.
 * @returns The transport's JSON response, or a JSON-RPC error envelope.
 */
export async function POST(request: Request): Promise<Response> {
  const origin = validateMcpOrigin(request)
  if (!origin.ok) {
    return jsonRpcError(origin.status, "Forbidden")
  }

  const auth = await authorizeMcpRequest(request)
  if (!auth.ok) {
    if (auth.status === 503) {
      return jsonRpcError(503, "Service unavailable")
    }
    return jsonRpcError(401, "Unauthorized", {
      headers: { "WWW-Authenticate": "Bearer" },
    })
  }

  const decision = mcpRateLimiter.check(auth.userId)
  if (!decision.allowed) {
    const probe = await probeJsonRpc(request)
    try {
      await recordMcpToolCall({
        userId: auth.userId,
        tool: probe.tool,
        args: null,
        outcome: "rate_limited",
        durationMs: 0,
      })
    } catch (err) {
      console.error("[mcp] audit write failed for rate-limited call", err)
    }
    return jsonRpcError(429, "Rate limit exceeded", {
      id: probe.id,
      headers: {
        "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)),
      },
    })
  }

  const server = buildServer(auth.userId)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  return transport.handleRequest(request)
}

/**
 * GET is not offered: the server is stateless JSON-only, no SSE stream.
 *
 * @returns 405 with an Allow header, per the Streamable HTTP transport spec.
 */
export function GET(): Response {
  return jsonRpcError(405, "Method not allowed", {
    headers: { Allow: "POST" },
  })
}

/**
 * DELETE is not offered: there are no sessions to terminate.
 *
 * @returns 405 with an Allow header, per the Streamable HTTP transport spec.
 */
export function DELETE(): Response {
  return jsonRpcError(405, "Method not allowed", {
    headers: { Allow: "POST" },
  })
}
