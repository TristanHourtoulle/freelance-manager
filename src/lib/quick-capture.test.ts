import { describe, expect, it } from "vitest"
import { quickDueOptions, toDateInputValue } from "./quick-capture"

describe("quickDueOptions", () => {
  it("returns the three shortcuts with their French labels", () => {
    const options = quickDueOptions(new Date(2026, 6, 15, 10, 0))
    expect(options.map((o) => o.id)).toEqual(["today", "tomorrow", "monday"])
    expect(options.map((o) => o.label)).toEqual([
      "Aujourd'hui",
      "Demain",
      "Lundi",
    ])
  })

  it("returns today at local midnight", () => {
    const [today] = quickDueOptions(new Date(2026, 6, 15, 23, 45))
    expect(today!.date).toEqual(new Date(2026, 6, 15, 0, 0, 0, 0))
  })

  it("rolls tomorrow over a month boundary", () => {
    const options = quickDueOptions(new Date(2026, 6, 31, 23, 0))
    expect(options[1]!.date).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0))
  })

  it("resolves Lundi to the next Monday from a Wednesday", () => {
    const options = quickDueOptions(new Date(2026, 6, 15, 9, 0))
    expect(new Date(2026, 6, 15).getDay()).toBe(3)
    expect(options[2]!.date).toEqual(new Date(2026, 6, 20, 0, 0, 0, 0))
  })

  it("resolves Lundi to the following week when today is Monday", () => {
    const monday = new Date(2026, 6, 20, 9, 0)
    expect(monday.getDay()).toBe(1)
    const options = quickDueOptions(monday)
    expect(options[2]!.date).toEqual(new Date(2026, 6, 27, 0, 0, 0, 0))
  })

  it("resolves Lundi to the next day when today is Sunday", () => {
    const sunday = new Date(2026, 6, 19, 9, 0)
    expect(sunday.getDay()).toBe(0)
    const options = quickDueOptions(sunday)
    expect(options[2]!.date).toEqual(new Date(2026, 6, 20, 0, 0, 0, 0))
  })
})

describe("toDateInputValue", () => {
  it("returns the local calendar day, never shifted by UTC", () => {
    expect(toDateInputValue(new Date(2026, 0, 1, 23, 30))).toBe("2026-01-01")
  })

  it("zero-pads month and day", () => {
    expect(toDateInputValue(new Date(2026, 8, 5))).toBe("2026-09-05")
  })
})
