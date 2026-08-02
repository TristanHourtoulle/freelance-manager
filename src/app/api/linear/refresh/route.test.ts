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

const runTaskSync = vi.fn()
vi.mock("@/lib/task-sync/run", () => ({
  runTaskSync: (...a: unknown[]) => runTaskSync(...a),
}))

const countMappings = vi.fn()
const linearProvider = {
  id: "linear",
  displayName: "Linear",
  countMappings: (...a: unknown[]) => countMappings(...a),
  sync: vi.fn(),
  cacheTags: (userId: string) => [
    `user-${userId}-linear-teams`,
    `user-${userId}-linear-projects`,
  ],
}
vi.mock("@/lib/task-sync/registry", () => ({
  getTaskProvider: () => linearProvider,
}))

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    taskSyncRun: { findFirst: vi.fn(), update: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const createSyncRun = vi.fn()
const failSyncRun = vi.fn()
vi.mock("@/lib/task-sync/progress", () => ({
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
    runTaskSync.mockReset()
    countMappings.mockReset()
    deferActivityLog.mockReset()
    getAuthUser.mockReset()
    requireSameOrigin.mockReset()
    requireSameOrigin.mockReturnValue(undefined)
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.taskSyncRun.findFirst.mockReset()
    prismaMock.taskSyncRun.update.mockReset()
    createSyncRun.mockReset()
    failSyncRun.mockReset()
    prismaMock.taskSyncRun.findFirst.mockResolvedValue(null)
    prismaMock.taskSyncRun.update.mockResolvedValue({})
    countMappings.mockResolvedValue(3)
    createSyncRun.mockResolvedValue("run-1")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns 202 immediately and defers the sync to after()", async () => {
    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({
      status: "started",
      runId: "run-1",
      totalMappings: 3,
    })
    expect(createSyncRun).toHaveBeenCalledWith("user-1", "linear", 3)
    expect(runTaskSync).not.toHaveBeenCalled()
    expect(afterCallback).toBeTypeOf("function")
  })

  it("runs the sync, revalidates tags and logs activity in after()", async () => {
    runTaskSync.mockResolvedValue({ tasks: 4, projects: 2 })

    const { POST } = await import("./route")
    await POST(makeRequest())
    await afterCallback?.()

    expect(runTaskSync).toHaveBeenCalledWith(linearProvider, {
      userId: "user-1",
      runId: "run-1",
    })
    expect(revalidateTag).toHaveBeenCalledTimes(4)
    expect(revalidateTag).toHaveBeenCalledWith(
      "user-user-1-linear-teams",
      "max",
    )
    expect(revalidateTag).toHaveBeenCalledWith("user-user-1-nav", "max")
    expect(deferActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", kind: "TASKS_SYNCED" }),
    )
  })

  it("swallows and logs a background sync failure without revalidating", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    runTaskSync.mockRejectedValue(new Error("boom"))

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
    runTaskSync.mockRejectedValue(error)

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
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
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
    expect(prismaMock.taskSyncRun.update).not.toHaveBeenCalled()
    expect(afterCallback).toBeNull()
  })

  it("scopes the running-run lookup to the session user", async () => {
    const { POST } = await import("./route")
    await POST(makeRequest())

    const arg = prismaMock.taskSyncRun.findFirst.mock.calls[0]![0]
    expect(arg.where).toEqual({
      userId: "user-1",
      providerId: "linear",
      status: "RUNNING",
    })
  })

  it("fails an abandoned run older than 10 minutes and starts a new one", async () => {
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      id: "run-stale",
      startedAt: new Date(Date.now() - 11 * 60_000),
    })

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({
      status: "started",
      runId: "run-1",
      totalMappings: 3,
    })

    const arg = prismaMock.taskSyncRun.update.mock.calls[0]![0]
    expect(arg.where).toEqual({ id: "run-stale" })
    expect(arg.data).toMatchObject({
      status: "FAILED",
      errorMessage: "Sync timed out or process restarted",
      currentLabel: null,
    })
    expect(createSyncRun).toHaveBeenCalledWith("user-1", "linear", 3)
    expect(afterCallback).toBeTypeOf("function")
  })

  it("flips the abandoned row to FAILED before inserting the new run", async () => {
    const order: string[] = []
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      id: "run-stale",
      startedAt: new Date(Date.now() - 11 * 60_000),
    })
    prismaMock.taskSyncRun.update.mockImplementation(async () => {
      order.push("fail-stale")
      return {}
    })
    createSyncRun.mockImplementation(async () => {
      order.push("create")
      return "run-1"
    })

    const { POST } = await import("./route")
    await POST(makeRequest())

    expect(order).toEqual(["fail-stale", "create"])
  })

  it("returns 409 when the unique index rejects a racing insert (P2002)", async () => {
    createSyncRun.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    )
    prismaMock.taskSyncRun.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "run-winner" })

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: "Sync already in progress",
      runId: "run-winner",
    })
    expect(afterCallback).toBeNull()
  })

  it("omits runId on a P2002 race whose winner already finished", async () => {
    createSyncRun.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    )
    prismaMock.taskSyncRun.findFirst.mockResolvedValue(null)

    const { POST } = await import("./route")
    const res = await POST(makeRequest())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: "Sync already in progress" })
  })

  it("rethrows a non-P2002 failure from createSyncRun", async () => {
    createSyncRun.mockRejectedValue(new Error("db down"))

    const { POST } = await import("./route")

    await expect(POST(makeRequest())).rejects.toThrow("db down")
    expect(afterCallback).toBeNull()
  })
})
