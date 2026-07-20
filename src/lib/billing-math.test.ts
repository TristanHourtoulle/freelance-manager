import { describe, expect, it } from "vitest"
import { allocateSplitAmounts } from "./billing-math"

function sumCents(amounts: readonly number[]): number {
  return amounts.reduce((s, a) => s + Math.round(a * 100), 0)
}

describe("allocateSplitAmounts", () => {
  it("gives the leftover cents to the earliest installments", () => {
    expect(allocateSplitAmounts(100, 3)).toEqual([33.34, 33.33, 33.33])
  })

  it("keeps a single-part split equal to the total", () => {
    expect(allocateSplitAmounts(100, 1)).toEqual([100])
  })

  it("splits an amount smaller than one cent per part", () => {
    expect(allocateSplitAmounts(0.01, 3)).toEqual([0.01, 0, 0])
  })

  it("splits 1000 into seven parts summing back exactly", () => {
    const amounts = allocateSplitAmounts(1000, 7)

    expect(amounts).toEqual([
      142.86, 142.86, 142.86, 142.86, 142.86, 142.85, 142.85,
    ])
    expect(sumCents(amounts)).toBe(100000)
  })

  it("splits evenly when the total divides exactly", () => {
    expect(allocateSplitAmounts(90, 3)).toEqual([30, 30, 30])
  })

  it("handles zero", () => {
    expect(allocateSplitAmounts(0, 4)).toEqual([0, 0, 0, 0])
  })

  it("splits negative totals into parts that sum back exactly", () => {
    const amounts = allocateSplitAmounts(-100, 3)

    expect(amounts).toEqual([-33.33, -33.33, -33.34])
    expect(sumCents(amounts)).toBe(-10000)
  })

  it("rounds a sub-cent total to the cent before allocating", () => {
    const amounts = allocateSplitAmounts(0.014, 2)

    expect(amounts).toEqual([0.01, 0])
  })

  it("sums back exactly for every part count from 1 to 36", () => {
    for (const total of [100, 0.07, 1234.56, 999.99]) {
      for (let parts = 1; parts <= 36; parts++) {
        const amounts = allocateSplitAmounts(total, parts)
        expect(amounts).toHaveLength(parts)
        expect(sumCents(amounts)).toBe(Math.round(total * 100))
      }
    }
  })

  it("never spreads more than one cent between two installments", () => {
    const amounts = allocateSplitAmounts(100, 7)
    const cents = amounts.map((a) => Math.round(a * 100))

    expect(Math.max(...cents) - Math.min(...cents)).toBe(1)
  })

  it("rejects a non-integer or non-positive part count", () => {
    expect(() => allocateSplitAmounts(100, 0)).toThrow(RangeError)
    expect(() => allocateSplitAmounts(100, -2)).toThrow(RangeError)
    expect(() => allocateSplitAmounts(100, 2.5)).toThrow(RangeError)
  })

  it("rejects a non-finite total", () => {
    expect(() => allocateSplitAmounts(Number.NaN, 3)).toThrow(RangeError)
    expect(() => allocateSplitAmounts(Number.POSITIVE_INFINITY, 3)).toThrow(
      RangeError,
    )
  })
})
