import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskProvider } from "@/lib/task-sync/provider"

const touchSyncRun = vi.fn()
const completeSyncRun = vi.fn()

vi.mock("@/lib/task-sync/progress", () => ({
  touchSyncRun: (...args: unknown[]) => touchSyncRun(...args),
  completeSyncRun: (...args: unknown[]) => completeSyncRun(...args),
}))

import { runTaskSync } from "@/lib/task-sync/run"

describe("runTaskSync", () => {
  const sync = vi.fn()
  const provider: TaskProvider = {
    id: "example",
    displayName: "Example",
    countMappings: vi.fn(),
    sync: (context) => sync(context),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("forwards provider progress to the persisted sync run", async () => {
    sync.mockImplementation(async ({ reportProgress }) => {
      await reportProgress({ doneMappings: 1, currentLabel: "Acme" })
      return { projects: 2, tasks: 4 }
    })

    await runTaskSync(provider, { userId: "user-1", runId: "run-1" })

    expect(touchSyncRun).toHaveBeenCalledWith("run-1", {
      doneMappings: 1,
      currentLabel: "Acme",
    })
  })

  it("marks the run complete with the provider result", async () => {
    sync.mockResolvedValue({ projects: 2, tasks: 4 })

    const result = await runTaskSync(provider, {
      userId: "user-1",
      runId: "run-1",
    })

    expect(result).toEqual({ projects: 2, tasks: 4 })
    expect(completeSyncRun).toHaveBeenCalledWith("run-1", {
      projectsUpserted: 2,
      tasksUpserted: 4,
    })
  })

  it("leaves failures open for the HTTP orchestration layer to record", async () => {
    sync.mockRejectedValue(new Error("provider unavailable"))

    await expect(
      runTaskSync(provider, { userId: "user-1", runId: "run-1" }),
    ).rejects.toThrow("provider unavailable")
    expect(completeSyncRun).not.toHaveBeenCalled()
  })
})
