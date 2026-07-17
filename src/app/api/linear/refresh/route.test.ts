import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

let afterCallback: (() => Promise<void>) | null = null

vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server")
  return {
    ...actual,
    after: (cb: () => Promise<void>) => {
      afterCallback = cb
    },
  }
})

const revalidateTag = vi.fn()
vi.mock("next/cache", () => ({
  revalidateTag: (...a: unknown[]) => revalidateTag(...a),
}))

const syncFromLinear = vi.fn()
vi.mock("@/lib/linear", () => ({
  syncFromLinear: (...a: unknown[]) => syncFromLinear(...a),
}))

const deferActivityLog = vi.fn()
vi.mock("@/lib/activity", () => ({
  deferActivityLog: (...a: unknown[]) => deferActivityLog(...a),
}))

vi.mock("@/lib/data/linear", () => ({
  linearTeamsTag: (id: string) => `user-${id}-linear-teams`,
  linearProjectsTag: (id: string) => `user-${id}-linear-projects`,
}))
vi.mock("@/lib/data/projects", () => ({
  projectsTag: (id: string) => `user-${id}-projects`,
}))
vi.mock("@/lib/data/nav", () => ({
  navTag: (id: string) => `user-${id}-nav`,
}))

const getAuthUser = vi.fn()
const requireSameOrigin = vi.fn()
vi.mock("@/lib/api", async () => {
  const { NextResponse } = await import("next/server")
  return {
    getAuthUser: (...a: unknown[]) => getAuthUser(...a),
    requireSameOrigin: (...a: unknown[]) => requireSameOrigin(...a),
    apiUnauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  }
})

function makeRequest() {
  return new Request("http://localhost/api/linear/refresh", { method: "POST" })
}

describe("POST /api/linear/refresh", () => {
  beforeEach(() => {
    afterCallback = null
    revalidateTag.mockReset()
    syncFromLinear.mockReset()
    deferActivityLog.mockReset()
    getAuthUser.mockReset()
    requireSameOrigin.mockReset()
    requireSameOrigin.mockReturnValue(undefined)
    getAuthUser.mockResolvedValue({ id: "user-1" })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 202 immediately and defers the sync to after()", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ status: "started" })
    expect(syncFromLinear).not.toHaveBeenCalled()
    expect(afterCallback).toBeTypeOf("function")
  })

  it("runs the sync, revalidates tags and logs activity in after()", async () => {
    syncFromLinear.mockResolvedValue({ tasks: 4, projects: 2 })

    const { POST } = await import("./route")
    await POST(makeRequest())
    await afterCallback?.()

    expect(syncFromLinear).toHaveBeenCalledWith("user-1")
    expect(revalidateTag).toHaveBeenCalledTimes(4)
    expect(revalidateTag).toHaveBeenCalledWith(
      "user-user-1-linear-teams",
      "max",
    )
    expect(revalidateTag).toHaveBeenCalledWith("user-user-1-nav", "max")
    expect(deferActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", kind: "LINEAR_SYNCED" }),
    )
  })

  it("swallows and logs a background sync failure without revalidating", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    syncFromLinear.mockRejectedValue(new Error("boom"))

    const { POST } = await import("./route")
    await POST(makeRequest())
    await expect(afterCallback?.()).resolves.toBeUndefined()

    expect(revalidateTag).not.toHaveBeenCalled()
    expect(deferActivityLog).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    expect(afterCallback).toBeNull()
  })
})
