import { describe, expect, it } from "vitest"
import { computeQuoteKpis, type QuoteKpiRow } from "./kpis"

function row(overrides: Partial<QuoteKpiRow> = {}): QuoteKpiRow {
  return {
    status: "DRAFT",
    sentAt: null,
    decidedAt: null,
    total: 0,
    ...overrides,
  }
}

describe("computeQuoteKpis", () => {
  it("returns zeroes for an empty input", () => {
    expect(computeQuoteKpis([])).toEqual({
      winRate: 0,
      avgDecisionDays: 0,
      pipelineValue: 0,
    })
  })

  it("reports a 100% win rate when every decided quote is accepted", () => {
    const kpis = computeQuoteKpis([
      row({ status: "ACCEPTED", total: 1000 }),
      row({ status: "ACCEPTED", total: 2000 }),
    ])

    expect(kpis.winRate).toBe(100)
    expect(kpis.pipelineValue).toBe(0)
  })

  it("reports a 0% win rate when every decided quote is refused", () => {
    const kpis = computeQuoteKpis([
      row({ status: "REFUSED", total: 1000 }),
      row({ status: "EXPIRED", total: 500 }),
    ])

    expect(kpis.winRate).toBe(0)
  })

  it("ignores DRAFT and SENT quotes in the win rate and counts them as pipeline", () => {
    const kpis = computeQuoteKpis([
      row({ status: "ACCEPTED", total: 1000 }),
      row({ status: "REFUSED", total: 800 }),
      row({ status: "DRAFT", total: 300 }),
      row({ status: "SENT", total: 700 }),
    ])

    expect(kpis.winRate).toBe(50)
    expect(kpis.pipelineValue).toBe(1000)
  })

  it("skips a decided quote with no sentAt from the decision delay", () => {
    const kpis = computeQuoteKpis([
      row({
        status: "ACCEPTED",
        sentAt: null,
        decidedAt: "2026-03-10T00:00:00.000Z",
      }),
      row({
        status: "ACCEPTED",
        sentAt: "2026-03-01T00:00:00.000Z",
        decidedAt: "2026-03-05T00:00:00.000Z",
      }),
    ])

    expect(kpis.avgDecisionDays).toBe(4)
  })

  it("skips a negative delta caused by a backdated decision", () => {
    const kpis = computeQuoteKpis([
      row({
        status: "REFUSED",
        sentAt: "2026-03-10T00:00:00.000Z",
        decidedAt: "2026-03-01T00:00:00.000Z",
      }),
      row({
        status: "ACCEPTED",
        sentAt: "2026-03-01T00:00:00.000Z",
        decidedAt: "2026-03-07T00:00:00.000Z",
      }),
    ])

    expect(kpis.avgDecisionDays).toBe(6)
  })

  it("rounds both the win rate and the decision delay", () => {
    const kpis = computeQuoteKpis([
      row({ status: "ACCEPTED" }),
      row({ status: "ACCEPTED" }),
      row({ status: "REFUSED" }),
      row({
        status: "ACCEPTED",
        sentAt: "2026-03-01T00:00:00.000Z",
        decidedAt: "2026-03-03T12:00:00.000Z",
      }),
    ])

    expect(kpis.winRate).toBe(75)
    expect(kpis.avgDecisionDays).toBe(3)
  })
})
