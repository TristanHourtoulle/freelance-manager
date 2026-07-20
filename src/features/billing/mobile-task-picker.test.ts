import { describe, expect, it } from "vitest"
import {
  mergePickableTasks,
  selectedTaskIds,
} from "@/features/billing/mobile-task-picker"

const tasks = [{ id: "t1" }, { id: "t2" }, { id: "t3" }]

describe("selectedTaskIds", () => {
  it("keeps only the lines bound to a task", () => {
    const ids = selectedTaskIds([
      { taskId: "t1" },
      { taskId: null },
      { taskId: "t3" },
    ])
    expect([...ids].sort()).toEqual(["t1", "t3"])
  })

  it("returns an empty set for manual-only lines", () => {
    expect(selectedTaskIds([{ taskId: null }]).size).toBe(0)
  })
})

describe("mergePickableTasks", () => {
  it("keeps a selected task in the list once it is no longer eligible", () => {
    const eligible = [{ id: "t2" }, { id: "t3" }]
    const merged = mergePickableTasks(tasks, eligible, [{ taskId: "t1" }])
    expect(merged.map((t) => t.id)).toEqual(["t1", "t2", "t3"])
  })

  it("preserves the source order rather than the selection order", () => {
    const merged = mergePickableTasks(tasks, [{ id: "t1" }], [{ taskId: "t3" }])
    expect(merged.map((t) => t.id)).toEqual(["t1", "t3"])
  })

  it("drops tasks that are neither eligible nor selected", () => {
    expect(mergePickableTasks(tasks, [], [])).toEqual([])
  })
})
