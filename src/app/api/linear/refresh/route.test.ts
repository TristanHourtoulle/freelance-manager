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

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    linearSyncRun: { findFirst: vi.fn(), update: vi.fn() },
    linearMapping: { count: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const createSyncRun = vi.fn()
const failSyncRun = vi.fn()
vi.mock("@/lib/linear-sync-progress", () => ({
  createSyncRun: (...a: unknown[]) => createSyncRun(...a),
  failSyncRun: (...a: unknown[]) => failSyncRun(...a),
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
    prismaMock.linearSyncRun.findFirst.mockReset()
    prismaMock.linearSyncRun.update.mockReset()
    prismaMock.linearMapping.count.mockReset()
    createSyncRun.mockReset()
    failSyncRun.mockReset()
    prismaMock.linearSyncRun.findFirst.mockResolvedValue(null)
    prismaMock.linearSyncRun.update.mockResolvedValue({})
    prismaMock.linearMapping.count.mockResolvedValue(3)
    createSyncRun.mockResolvedValue("run-1")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 202 immediately and defers the sync to after()", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ status: "started", runId: "run-1" })
    expect(createSyncRun).toHaveBeenCalledWith("user-1", 3)
    expect(syncFromLinear).not.toHaveBeenCalled()
    expect(afterCallback).toBeTypeOf("function")
  })

  it("runs the sync, revalidates tags and logs activity in after()", async () => {
    syncFromLinear.mockResolvedValue({ tasks: 4, projects: 2 })

    const { POST } = await import("./route")
    await POST(makeRequest())
    await afterCallback?.()

    expect(syncFromLinear).toHaveBeenCalledWith("user-1", "run-1")
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

  it("marks the run FAILED when the background sync throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const error = new Error("boom")
    syncFromLinear.mockRejectedValue(error)

    const { POST } = await import("./route")
    await POST(makeRequest())
    await afterCallback?.()

    expect(failSyncRun).toHaveBeenCalledWith("run-1", error)
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    expect(afterCallback).toBeNull()
  })

  it("returns 409 with the live runId when a sync is already running", async () => {
    prismaMock.linearSyncRun.findFirst.mockResolvedValue({
      id: "run-live",
      startedAt: new Date(Date.now() - 30_000),
    })

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: "Sync already in progress",
      runId: "run-live",
    })
    expect(createSyncRun).not.toHaveBeenCalled()
    expect(prismaMock.linearSyncRun.update).not.toHaveBeenCalled()
    expect(afterCallback).toBeNull()
  })

  it("scopes the running-run lookup to the session user", async () => {
    const { POST } = await import("./route")
    await POST(makeRequest())

    const arg = prismaMock.linearSyncRun.findFirst.mock.calls[0]![0]
    expect(arg.where).toEqual({ userId: "user-1", status: "RUNNING" })
  })

  it("fails an abandoned run older than 10 minutes and starts a new one", async () => {
    prismaMock.linearSyncRun.findFirst.mockResolvedValue({
      id: "run-stale",
      startedAt: new Date(Date.now() - 11 * 60_000),
    })

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ status: "started", runId: "run-1" })

    const arg = prismaMock.linearSyncRun.update.mock.calls[0]![0]
    expect(arg.where).toEqual({ id: "run-stale" })
    expect(arg.data).toMatchObject({
      status: "FAILED",
      errorMessage: "Sync timed out or process restarted",
      currentLabel: null,
    })
    expect(createSyncRun).toHaveBeenCalledWith("user-1", 3)
    expect(afterCallback).toBeTypeOf("function")
  })
})
