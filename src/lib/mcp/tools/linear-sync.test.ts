import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    taskSyncRun: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

const triggerLinearSync = vi.fn()
vi.mock("@/lib/linear-sync-trigger", () => ({
  triggerLinearSync: (...args: unknown[]) => triggerLinearSync(...args),
}))

import {
  getLinearSyncStatus,
  triggerLinearSyncTool,
  TRIGGER_COOLDOWN_MS,
} from "./linear-sync"

const USER_ID = "user-1"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("triggerLinearSyncTool", () => {
  it("starts a sync when the user has never synced before", async () => {
    prismaMock.taskSyncRun.findFirst.mockResolvedValue(null)
    triggerLinearSync.mockResolvedValue({ status: "started", runId: "run-1" })

    const result = await triggerLinearSyncTool(USER_ID)

    expect(prismaMock.taskSyncRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, providerId: "linear" },
      }),
    )
    expect(triggerLinearSync).toHaveBeenCalledWith(USER_ID)
    const structured = result.structuredContent as {
      status: string
      runId: string
      statusTool: string
    }
    expect(structured.status).toBe("started")
    expect(structured.runId).toBe("run-1")
    expect(structured.statusTool).toBe("get_linear_sync_status")
    expect(result.isError).toBeUndefined()
  })

  it("refuses with cooldown when the last run finished recently", async () => {
    const startedAt = new Date(Date.now() - 1_000)
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      status: "COMPLETED",
      startedAt,
    })

    const result = await triggerLinearSyncTool(USER_ID)

    expect(triggerLinearSync).not.toHaveBeenCalled()
    expect(result.isError).toBe(true)
    const structured = result.structuredContent as {
      status: string
      retryAfterSeconds: number
    }
    expect(structured.status).toBe("cooldown")
    expect(structured.retryAfterSeconds).toBeGreaterThan(0)
    expect(structured.retryAfterSeconds).toBeLessThanOrEqual(
      TRIGGER_COOLDOWN_MS / 1000,
    )
  })

  it("starts a new sync once the cooldown has elapsed", async () => {
    const startedAt = new Date(Date.now() - TRIGGER_COOLDOWN_MS - 5_000)
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      status: "FAILED",
      startedAt,
    })
    triggerLinearSync.mockResolvedValue({ status: "started", runId: "run-2" })

    const result = await triggerLinearSyncTool(USER_ID)

    expect(triggerLinearSync).toHaveBeenCalledWith(USER_ID)
    const structured = result.structuredContent as { status: string }
    expect(structured.status).toBe("started")
  })

  it("bypasses the cooldown and reports in_progress when a run is already RUNNING", async () => {
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      status: "RUNNING",
      startedAt: new Date(),
    })
    triggerLinearSync.mockResolvedValue({
      status: "in_progress",
      runId: "run-3",
    })

    const result = await triggerLinearSyncTool(USER_ID)

    expect(triggerLinearSync).toHaveBeenCalledWith(USER_ID)
    expect(result.isError).toBe(true)
    const structured = result.structuredContent as {
      status: string
      runId: string | null
      statusTool: string
    }
    expect(structured.status).toBe("in_progress")
    expect(structured.runId).toBe("run-3")
    expect(structured.statusTool).toBe("get_linear_sync_status")
  })

  it("still reports in_progress when the race edge case returns a null runId", async () => {
    prismaMock.taskSyncRun.findFirst.mockResolvedValue(null)
    triggerLinearSync.mockResolvedValue({ status: "in_progress", runId: null })

    const result = await triggerLinearSyncTool(USER_ID)

    expect(result.isError).toBe(true)
    const structured = result.structuredContent as {
      status: string
      runId: string | null
    }
    expect(structured.status).toBe("in_progress")
    expect(structured.runId).toBeNull()
  })
})

describe("getLinearSyncStatus", () => {
  it("returns idle when the user has never synced", async () => {
    prismaMock.taskSyncRun.findFirst.mockResolvedValue(null)

    const result = await getLinearSyncStatus(USER_ID)

    expect(prismaMock.taskSyncRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, providerId: "linear" },
      }),
    )
    expect(result.structuredContent).toEqual({
      status: "idle",
      runId: null,
      totalMappings: null,
      doneMappings: null,
      currentLabel: null,
      projectsUpserted: null,
      tasksUpserted: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
    })
  })

  it("maps the latest run, including a null finishedAt while RUNNING", async () => {
    const startedAt = new Date("2026-07-28T10:00:00.000Z")
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      id: "run-1",
      status: "RUNNING",
      totalMappings: 10,
      doneMappings: 4,
      currentLabel: "Acme Corp",
      projectsUpserted: 2,
      tasksUpserted: 9,
      errorMessage: null,
      startedAt,
      finishedAt: null,
    })

    const result = await getLinearSyncStatus(USER_ID)

    expect(result.structuredContent).toEqual({
      status: "RUNNING",
      runId: "run-1",
      totalMappings: 10,
      doneMappings: 4,
      currentLabel: "Acme Corp",
      projectsUpserted: 2,
      tasksUpserted: 9,
      errorMessage: null,
      startedAt: startedAt.toISOString(),
      finishedAt: null,
    })
  })

  it("surfaces errorMessage on a FAILED run", async () => {
    const startedAt = new Date("2026-07-28T10:00:00.000Z")
    const finishedAt = new Date("2026-07-28T10:05:00.000Z")
    prismaMock.taskSyncRun.findFirst.mockResolvedValue({
      id: "run-1",
      status: "FAILED",
      totalMappings: 10,
      doneMappings: 3,
      currentLabel: null,
      projectsUpserted: 1,
      tasksUpserted: 2,
      errorMessage: "Linear API timeout",
      startedAt,
      finishedAt,
    })

    const result = await getLinearSyncStatus(USER_ID)

    const structured = result.structuredContent as {
      status: string
      errorMessage: string | null
      finishedAt: string | null
    }
    expect(structured.status).toBe("FAILED")
    expect(structured.errorMessage).toBe("Linear API timeout")
    expect(structured.finishedAt).toBe(finishedAt.toISOString())
  })
})
