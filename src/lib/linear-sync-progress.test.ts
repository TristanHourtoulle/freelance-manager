import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    linearSyncRun: { create: vi.fn(), update: vi.fn() },
  },
}))

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

import {
  completeSyncRun,
  createSyncRun,
  failSyncRun,
  touchSyncRun,
} from "@/lib/linear-sync-progress"

describe("createSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.linearSyncRun.create.mockResolvedValue({ id: "run-1" })
  })

  it("opens a RUNNING row for the user and returns its id", async () => {
    const id = await createSyncRun("user-1", 3)

    expect(id).toBe("run-1")
    expect(prismaMock.linearSyncRun.create).toHaveBeenCalledWith({
      data: { userId: "user-1", totalMappings: 3, status: "RUNNING" },
      select: { id: true },
    })
  })
})

describe("touchSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.linearSyncRun.update.mockResolvedValue({})
  })

  it("writes only the supplied progress fields", async () => {
    await touchSyncRun("run-1", { doneMappings: 2, currentLabel: "Acme" })

    expect(prismaMock.linearSyncRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { doneMappings: 2, currentLabel: "Acme" },
    })
  })

  it("omits fields that were not provided", async () => {
    await touchSyncRun("run-1", { doneMappings: 5 })

    expect(prismaMock.linearSyncRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { doneMappings: 5 },
    })
  })

  it("is a no-op when no runId is given", async () => {
    await touchSyncRun(null, { doneMappings: 1 })
    await touchSyncRun(undefined, { doneMappings: 1 })

    expect(prismaMock.linearSyncRun.update).not.toHaveBeenCalled()
  })

  it("swallows and logs a database error instead of rethrowing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    prismaMock.linearSyncRun.update.mockRejectedValue(new Error("db down"))

    await expect(
      touchSyncRun("run-1", { doneMappings: 1 }),
    ).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe("completeSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.linearSyncRun.update.mockResolvedValue({})
  })

  it("marks the run COMPLETED with its final counters and clears the label", async () => {
    await completeSyncRun("run-1", { projectsUpserted: 2, tasksUpserted: 7 })

    const arg = prismaMock.linearSyncRun.update.mock.calls[0]![0]
    expect(arg.where).toEqual({ id: "run-1" })
    expect(arg.data).toMatchObject({
      status: "COMPLETED",
      projectsUpserted: 2,
      tasksUpserted: 7,
      currentLabel: null,
    })
    expect(arg.data.finishedAt).toBeInstanceOf(Date)
  })

  it("is a no-op when no runId is given", async () => {
    await completeSyncRun(null, { projectsUpserted: 1, tasksUpserted: 1 })

    expect(prismaMock.linearSyncRun.update).not.toHaveBeenCalled()
  })

  it("swallows a database error instead of rethrowing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    prismaMock.linearSyncRun.update.mockRejectedValue(new Error("db down"))

    await expect(
      completeSyncRun("run-1", { projectsUpserted: 0, tasksUpserted: 0 }),
    ).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe("failSyncRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.linearSyncRun.update.mockResolvedValue({})
  })

  it("stores the error message truncated to 500 characters", async () => {
    await failSyncRun("run-1", new Error("x".repeat(900)))

    const arg = prismaMock.linearSyncRun.update.mock.calls[0]![0]
    expect(arg.data.status).toBe("FAILED")
    expect(arg.data.errorMessage).toHaveLength(500)
    expect(arg.data.finishedAt).toBeInstanceOf(Date)
  })

  it("never serializes a non-Error thrown value, which could leak the token", async () => {
    await failSyncRun("run-1", {
      response: { headers: { authorization: "lin_api_secret" } },
    })

    const arg = prismaMock.linearSyncRun.update.mock.calls[0]![0]
    expect(arg.data.errorMessage).toBe("Sync failed")
    expect(JSON.stringify(arg.data)).not.toContain("lin_api_secret")
  })

  it("is a no-op when no runId is given", async () => {
    await failSyncRun(null, new Error("boom"))

    expect(prismaMock.linearSyncRun.update).not.toHaveBeenCalled()
  })

  it("swallows a database error instead of rethrowing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    prismaMock.linearSyncRun.update.mockRejectedValue(new Error("db down"))

    await expect(
      failSyncRun("run-1", new Error("boom")),
    ).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
