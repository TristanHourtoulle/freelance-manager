import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash, timingSafeEqual } from "crypto"
import { authorizeMcpRequest } from "./auth"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { user: { findMany: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

vi.mock("crypto", async () => {
  const actual =
    await vi.importActual<typeof import("node:crypto")>("node:crypto")
  const timingSafeEqualSpy = vi.fn(actual.timingSafeEqual)
  const replaced = {
    createHash: actual.createHash,
    timingSafeEqual: timingSafeEqualSpy,
  }
  return { ...actual, ...replaced, default: { ...actual, ...replaced } }
})

const TOKEN = "3f7a1c9d2e4b6a8c0f1e3d5c7b9a2f4e6d8c0b1a3f5e7d9c2b4a6f8e0d1c3b5a"
const HASH = createHash("sha256").update(TOKEN, "utf8").digest("hex")

function request(authorization?: string): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: authorization ? { authorization } : {},
  })
}

describe("authorizeMcpRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("MCP_TOKEN_HASH", HASH)
    prismaMock.user.findMany.mockResolvedValue([{ id: "user-1" }])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 503 when MCP_TOKEN_HASH is unset", async () => {
    vi.stubEnv("MCP_TOKEN_HASH", "")
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({
      ok: false,
      status: 503,
      code: "MCP_NOT_CONFIGURED",
    })
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("returns 503 when MCP_TOKEN_HASH is not 64 hex chars", async () => {
    vi.stubEnv("MCP_TOKEN_HASH", "not-a-hash")
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({
      ok: false,
      status: 503,
      code: "MCP_NOT_CONFIGURED",
    })
  })

  it("returns 401 when the Authorization header is missing", async () => {
    const result = await authorizeMcpRequest(request())
    expect(result).toEqual({ ok: false, status: 401, code: "MCP_BAD_TOKEN" })
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("returns 401 for a non-bearer scheme", async () => {
    const result = await authorizeMcpRequest(request("Basic abc123"))
    expect(result).toEqual({ ok: false, status: 401, code: "MCP_BAD_TOKEN" })
  })

  it("returns 401 for a wrong token and compares in constant time", async () => {
    const result = await authorizeMcpRequest(
      request(`Bearer ${"b".repeat(64)}`),
    )
    expect(result).toEqual({ ok: false, status: 401, code: "MCP_BAD_TOKEN" })
    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalledTimes(1)
  })

  it("still calls timingSafeEqual when the token length differs wildly", async () => {
    const result = await authorizeMcpRequest(request("Bearer x"))
    expect(result).toEqual({ ok: false, status: 401, code: "MCP_BAD_TOKEN" })
    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalledTimes(1)
    const [a, b] = vi.mocked(timingSafeEqual).mock.calls[0] ?? []
    expect(Buffer.isBuffer(a) && a.length).toBe(32)
    expect(Buffer.isBuffer(b) && b.length).toBe(32)
  })

  it("resolves the single owner for the right token", async () => {
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({ ok: true, userId: "user-1" })
    expect(vi.mocked(timingSafeEqual)).toHaveBeenCalledTimes(1)
  })

  it("accepts an uppercase configured hash", async () => {
    vi.stubEnv("MCP_TOKEN_HASH", HASH.toUpperCase())
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({ ok: true, userId: "user-1" })
  })

  it("returns 503 when no user row exists", async () => {
    prismaMock.user.findMany.mockResolvedValue([])
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({
      ok: false,
      status: 503,
      code: "MCP_NO_PRINCIPAL",
    })
  })

  it("fails closed when more than one user row exists", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "user-1" },
      { id: "user-2" },
    ])
    const result = await authorizeMcpRequest(request(`Bearer ${TOKEN}`))
    expect(result).toEqual({
      ok: false,
      status: 503,
      code: "MCP_AMBIGUOUS_PRINCIPAL",
    })
  })

  it("never includes the token or hash in any result", async () => {
    const outcomes = await Promise.all([
      authorizeMcpRequest(request(`Bearer ${TOKEN}`)),
      authorizeMcpRequest(request("Bearer wrong")),
      authorizeMcpRequest(request()),
    ])
    for (const outcome of outcomes) {
      const dump = JSON.stringify(outcome)
      expect(dump).not.toContain(TOKEN)
      expect(dump).not.toContain(HASH)
    }
  })
})
