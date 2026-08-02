import { beforeEach, describe, expect, it, vi } from "vitest"

const { taskSyncRun } = vi.hoisted(() => ({
  taskSyncRun: { findFirst: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ prisma: { taskSyncRun } }))

const getAuthUser = vi.fn()
vi.mock("@/lib/api", async () => {
  const { NextResponse } = await import("next/server")
  return {
    getAuthUser: (...args: unknown[]) => getAuthUser(...args),
    requireSameOrigin: vi.fn(),
    apiUnauthorized: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    apiNotFound: () =>
      NextResponse.json({ error: "Not Found" }, { status: 404 }),
    apiServerError: () =>
      NextResponse.json({ error: "Server Error" }, { status: 500 }),
  }
})

import { getTaskSyncStatus } from "@/lib/task-sync/http"

describe("task sync HTTP provider boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
  })

  it("returns 404 for an unregistered provider without querying sync rows", async () => {
    const response = await getTaskSyncStatus("github")

    expect(response.status).toBe(404)
    expect(taskSyncRun.findFirst).not.toHaveBeenCalled()
  })
})
