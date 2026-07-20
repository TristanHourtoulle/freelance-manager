import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { linearSyncRun: { findFirst: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/api", async () => {
  const { NextResponse } = await import("next/server")
  return {
    getAuthUser: (...a: unknown[]) => getAuthUser(...a),
    apiUnauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    apiServerError: () =>
      NextResponse.json({ error: "Server Error" }, { status: 500 }),
  }
})

const RUN = {
  id: "run-1",
  status: "RUNNING",
  totalMappings: 4,
  doneMappings: 1,
  currentLabel: "Acme",
  projectsUpserted: 0,
  tasksUpserted: 0,
  errorMessage: null,
  startedAt: new Date("2026-07-20T10:00:00.000Z"),
  finishedAt: null,
}

describe("GET /api/linear/sync-status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.linearSyncRun.findFirst.mockResolvedValue(RUN)
  })

  it("returns the latest run as a serialized DTO", async () => {
    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      runId: "run-1",
      status: "RUNNING",
      totalMappings: 4,
      doneMappings: 1,
      currentLabel: "Acme",
      projectsUpserted: 0,
      tasksUpserted: 0,
      errorMessage: null,
      startedAt: "2026-07-20T10:00:00.000Z",
      finishedAt: null,
    })
  })

  it("scopes the lookup to the session user and never to a client-supplied id", async () => {
    const { GET } = await import("./route")
    await GET()

    const arg = prismaMock.linearSyncRun.findFirst.mock.calls[0]![0]
    expect(arg.where).toEqual({ userId: "user-1" })
    expect(arg.orderBy).toEqual({ startedAt: "desc" })
  })

  it("never returns another user's run", async () => {
    getAuthUser.mockResolvedValue({ id: "user-2" })
    prismaMock.linearSyncRun.findFirst.mockImplementation(
      async (args: { where: { userId: string } }) =>
        args.where.userId === "user-1" ? RUN : null,
    )

    const { GET } = await import("./route")
    const res = await GET()
    const body = await res.json()

    expect(body).toEqual({ status: "idle" })
    expect(JSON.stringify(body)).not.toContain("run-1")
  })

  it("returns the idle shape when the user has never synced", async () => {
    prismaMock.linearSyncRun.findFirst.mockResolvedValue(null)

    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "idle" })
  })

  it("returns 401 when unauthenticated", async () => {
    getAuthUser.mockResolvedValue(null)

    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(401)
    expect(prismaMock.linearSyncRun.findFirst).not.toHaveBeenCalled()
  })

  it("returns 500 when the query throws", async () => {
    prismaMock.linearSyncRun.findFirst.mockRejectedValue(new Error("db down"))

    const { GET } = await import("./route")
    const res = await GET()

    expect(res.status).toBe(500)
  })
})
