import { describe, expect, it } from "vitest"
import { statusesForFilter, type ActionFilter } from "./suivi-view"

describe("statusesForFilter", () => {
  it("never hides WAITING actions behind a non-done filter", () => {
    const nonDone: ActionFilter[] = ["today", "upcoming", "all"]
    for (const filter of nonDone) {
      expect(statusesForFilter(filter)).toContain("WAITING")
      expect(statusesForFilter(filter)).toContain("TODO")
    }
  })

  it("requests only DONE for the done filter", () => {
    expect(statusesForFilter("done")).toEqual(["DONE"])
  })

  it("requests only WAITING for the waiting filter", () => {
    expect(statusesForFilter("waiting")).toEqual(["WAITING"])
  })

  it("never requests DONE from a non-done filter", () => {
    const nonDone: ActionFilter[] = ["today", "upcoming", "waiting", "all"]
    for (const filter of nonDone) {
      expect(statusesForFilter(filter)).not.toContain("DONE")
    }
  })
})
