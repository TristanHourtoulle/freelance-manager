import { describe, expect, it } from "vitest"
import { taskGroupCreateSchema, taskGroupUpdateSchema } from "./task-group"

describe("taskGroupCreateSchema", () => {
  it("normalizes a client-scoped group with unique tasks", () => {
    expect(
      taskGroupCreateSchema.parse({
        clientId: "client-1",
        name: "  Bucket & CDN  ",
        taskIds: ["task-1", "task-2"],
      }),
    ).toEqual({
      clientId: "client-1",
      name: "Bucket & CDN",
      taskIds: ["task-1", "task-2"],
    })
  })

  it("rejects duplicate task ids", () => {
    expect(
      taskGroupCreateSchema.safeParse({
        clientId: "client-1",
        name: "Bucket",
        taskIds: ["task-1", "task-1"],
      }).success,
    ).toBe(false)
  })

  it("requires at least one task and a non-empty name", () => {
    expect(
      taskGroupCreateSchema.safeParse({
        clientId: "client-1",
        name: "   ",
        taskIds: [],
      }).success,
    ).toBe(false)
  })
})

describe("taskGroupUpdateSchema", () => {
  it("does not allow moving a group to another client", () => {
    const result = taskGroupUpdateSchema.safeParse({
      clientId: "other-client",
      name: "Bucket",
      taskIds: ["task-1"],
    })

    expect(result.success).toBe(false)
  })
})
