import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { validateMcpOrigin } from "./origin"

const APP_URL = "https://freelance-manager.example.test"

function request(origin?: string): Request {
  return new Request("http://localhost/mcp", {
    method: "POST",
    headers: origin === undefined ? {} : { origin },
  })
}

describe("validateMcpOrigin", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP_URL)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("allows a request without an Origin header (server-to-server)", () => {
    expect(validateMcpOrigin(request())).toEqual({ ok: true })
  })

  it("allows the app's own origin", () => {
    expect(validateMcpOrigin(request(APP_URL))).toEqual({ ok: true })
  })

  it("rejects a cross-site origin", () => {
    expect(validateMcpOrigin(request("https://evil.example.com"))).toEqual({
      ok: false,
      status: 403,
      code: "MCP_ORIGIN_FORBIDDEN",
    })
  })

  it("rejects the opaque 'null' origin", () => {
    expect(validateMcpOrigin(request("null")).ok).toBe(false)
  })

  it("rejects a near-miss origin with a trailing slash", () => {
    expect(validateMcpOrigin(request(`${APP_URL}/`)).ok).toBe(false)
  })

  it("rejects a suffix-spoofed origin", () => {
    expect(validateMcpOrigin(request(`${APP_URL}.evil.example.com`)).ok).toBe(
      false,
    )
  })

  it("fails closed for any present origin when NEXT_PUBLIC_APP_URL is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    expect(validateMcpOrigin(request(APP_URL)).ok).toBe(false)
    expect(validateMcpOrigin(request()).ok).toBe(true)
  })
})
