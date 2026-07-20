import { describe, expect, it } from "vitest"
import { buildAnalyticsCsv } from "./analytics-csv"
import type { AnalyticsDTO } from "@/hooks/use-analytics"

type ClientRow = AnalyticsDTO["byClient"][number]

function makeClient(
  overrides: Partial<ClientRow["client"]> = {},
  rest: Partial<Omit<ClientRow, "client">> = {},
): ClientRow {
  return {
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      color: null,
      ...overrides,
    },
    revenue: 42000,
    days: 84,
    effectiveRate: 500,
    ...rest,
  }
}

function makeData(overrides: Partial<AnalyticsDTO> = {}): AnalyticsDTO {
  return {
    range: "12m",
    months: [
      { label: "janv.", paid: 12000, issued: 15000, isCurrent: false },
      { label: "févr.", paid: 9000, issued: 9000, isCurrent: true },
    ],
    kpi: {
      totalRevenue: 21000,
      avgRevenue: 10500,
      trend: 4,
      paidCount: 3,
      avgDelay: 12,
      avgInvoice: 7000,
      collectionRate: 80,
      winRate: 50,
      avgDecisionDays: 4,
      runRate: 126000,
    },
    byClient: [makeClient()],
    byType: [],
    weeks: [],
    heatmap: [],
    ...overrides,
  }
}

describe("buildAnalyticsCsv", () => {
  it("starts with a UTF-8 BOM", () => {
    expect(buildAnalyticsCsv(makeData()).startsWith("﻿")).toBe(true)
  })

  it("writes the months section header and rows", () => {
    const lines = buildAnalyticsCsv(makeData()).split("\r\n")
    expect(lines[0]).toBe("﻿Mois;Encaissé;Émis")
    expect(lines[1]).toBe("janv.;12000;15000")
    expect(lines[2]).toBe("févr.;9000;9000")
  })

  it("separates the two sections with a blank line", () => {
    const lines = buildAnalyticsCsv(makeData()).split("\r\n")
    expect(lines[3]).toBe("")
    expect(lines[4]).toBe("Client;Revenu;Jours;TJM effectif")
  })

  it("prefers the company name over the first and last name", () => {
    const csv = buildAnalyticsCsv(makeData())
    expect(csv).toContain("Analytical;42000;84;500")
  })

  it("falls back to the first and last name when there is no company", () => {
    const csv = buildAnalyticsCsv(
      makeData({ byClient: [makeClient({ company: null })] }),
    )
    expect(csv).toContain("Ada Lovelace;42000;84;500")
  })

  it("renders a null effective rate as an empty field", () => {
    const csv = buildAnalyticsCsv(
      makeData({ byClient: [makeClient({}, { effectiveRate: null })] }),
    )
    expect(csv).toContain("Analytical;42000;84;")
  })

  it("quotes a company name containing the delimiter", () => {
    const csv = buildAnalyticsCsv(
      makeData({ byClient: [makeClient({ company: "Dupont; Fils" })] }),
    )
    expect(csv).toContain('"Dupont; Fils";42000;84;500')
  })

  it("doubles inner double quotes", () => {
    const csv = buildAnalyticsCsv(
      makeData({ byClient: [makeClient({ company: 'Le "Studio"' })] }),
    )
    expect(csv).toContain('"Le ""Studio""";42000;84;500')
  })

  it("still emits both headers for an empty payload", () => {
    const csv = buildAnalyticsCsv(makeData({ months: [], byClient: [] }))
    expect(csv).toBe(
      "﻿Mois;Encaissé;Émis\r\n\r\nClient;Revenu;Jours;TJM effectif",
    )
  })
})
