import { describe, expect, it } from "vitest"
import { collectInvoicedTaskIds } from "./invoiced-tasks"

describe("collectInvoicedTaskIds", () => {
  it("unions explicitly selected ids with line-carried ids", () => {
    const result = collectInvoicedTaskIds(
      ["t1"],
      [{ taskId: "t2" }, { taskId: "t3" }],
    )

    expect(result).toEqual(["t1", "t2", "t3"])
  })

  it("deduplicates an id present in both sources", () => {
    const result = collectInvoicedTaskIds(
      ["t1", "t2"],
      [{ taskId: "t1" }, { taskId: "t2" }],
    )

    expect(result).toEqual(["t1", "t2"])
  })

  it("collects line ids when taskIds is undefined", () => {
    expect(collectInvoicedTaskIds(undefined, [{ taskId: "t1" }])).toEqual([
      "t1",
    ])
  })

  it("returns the selected ids unchanged when lines is empty", () => {
    expect(collectInvoicedTaskIds(["t1", "t2"], [])).toEqual(["t1", "t2"])
  })

  it("ignores lines whose taskId is null or undefined", () => {
    const result = collectInvoicedTaskIds(
      ["t1"],
      [{ taskId: null }, {}, { taskId: "t2" }],
    )

    expect(result).toEqual(["t1", "t2"])
  })

  it("returns an empty array when nothing references a task", () => {
    expect(collectInvoicedTaskIds(undefined, [{ taskId: null }, {}])).toEqual(
      [],
    )
  })

  it("keeps a stable order: selected ids first, then line ids in line order", () => {
    const result = collectInvoicedTaskIds(
      ["b", "a"],
      [{ taskId: "d" }, { taskId: "c" }, { taskId: "a" }],
    )

    expect(result).toEqual(["b", "a", "d", "c"])
  })
})
