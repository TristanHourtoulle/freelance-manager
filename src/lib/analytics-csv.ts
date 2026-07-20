import type { AnalyticsDTO } from "@/hooks/use-analytics"

const DELIMITER = ";"
const EOL = "\r\n"
const BOM = "﻿"

function escapeCsvField(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function row(fields: readonly string[]): string {
  return fields.map(escapeCsvField).join(DELIMITER)
}

/**
 * Builds a machine-readable CSV export of an analytics payload.
 *
 * @param data - The analytics payload currently displayed by the page.
 * @returns A BOM-prefixed, semicolon-delimited CSV with a monthly revenue
 * section and a per-client section separated by a blank line.
 */
export function buildAnalyticsCsv(data: AnalyticsDTO): string {
  const monthLines = [
    row(["Mois", "Encaissé", "Émis"]),
    ...data.months.map((m) => row([m.label, String(m.paid), String(m.issued)])),
  ]

  const clientLines = [
    row(["Client", "Revenu", "Jours", "TJM effectif"]),
    ...data.byClient.map((c) =>
      row([
        c.client.company ?? `${c.client.firstName} ${c.client.lastName}`,
        String(c.revenue),
        String(c.days),
        c.effectiveRate === null ? "" : String(c.effectiveRate),
      ]),
    ),
  ]

  return BOM + [...monthLines, "", ...clientLines].join(EOL)
}

/**
 * Triggers a browser download of the analytics CSV for the given payload.
 *
 * @param data - The analytics payload currently displayed by the page.
 */
export function downloadAnalyticsCsv(data: AnalyticsDTO): void {
  const csv = buildAnalyticsCsv(data)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `analytics-${data.range}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
