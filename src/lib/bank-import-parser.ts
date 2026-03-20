import type { BankTransactionRow } from "@/lib/schemas/bank-transaction"

/** Supported bank CSV formats with their column mappings. */
interface BankFormat {
  name: string
  /** Detect this format from header columns. */
  detect: (headers: string[]) => boolean
  /** Map a CSV row (keyed by header) to a BankTransactionRow. */
  parse: (row: Record<string, string>) => BankTransactionRow
}

/** Normalize a header string for comparison. */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[""]/g, "").replace(/\s+/g, " ")
}

/** Parse a French or ISO date string into a Date. */
function parseDate(value: string): Date {
  const trimmed = value.trim()

  // French format: DD/MM/YYYY
  const frenchMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (frenchMatch) {
    const [, day, month, year] = frenchMatch
    return new Date(`${year}-${month}-${day}`)
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return new Date(trimmed)
  }

  // Fallback
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) {
    throw new Error(`Unable to parse date: ${value}`)
  }
  return parsed
}

/** Parse a French-formatted number (comma as decimal separator). */
function parseAmount(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  if (isNaN(num)) {
    throw new Error(`Unable to parse amount: ${value}`)
  }
  return num
}

/** Boursorama CSV format. */
const boursoramaFormat: BankFormat = {
  name: "Boursorama",
  detect: (headers) => {
    const normalized = headers.map(normalizeHeader)
    return (
      normalized.includes("dateop") &&
      normalized.includes("label") &&
      normalized.includes("amount")
    )
  },
  parse: (row) => ({
    date: parseDate(row["dateOp"] ?? row["dateop"] ?? ""),
    description: (row["label"] ?? row["Label"] ?? "").trim(),
    amount: parseAmount(row["amount"] ?? row["Amount"] ?? "0"),
    bankName: "Boursorama",
  }),
}

/** LCL CSV format. */
const lclFormat: BankFormat = {
  name: "LCL",
  detect: (headers) => {
    const normalized = headers.map(normalizeHeader)
    return (
      normalized.includes("date") &&
      normalized.includes("libelle") &&
      (normalized.includes("debit") || normalized.includes("credit"))
    )
  },
  parse: (row) => {
    const debit = row["Debit"] ?? row["debit"] ?? ""
    const credit = row["Credit"] ?? row["credit"] ?? ""
    const amount = debit ? -Math.abs(parseAmount(debit)) : parseAmount(credit)

    return {
      date: parseDate(row["Date"] ?? row["date"] ?? ""),
      description: (row["Libelle"] ?? row["libelle"] ?? "").trim(),
      amount,
      bankName: "LCL",
    }
  },
}

/** Societe Generale CSV format. */
const sgFormat: BankFormat = {
  name: "Societe Generale",
  detect: (headers) => {
    const normalized = headers.map(normalizeHeader)
    return (
      normalized.includes("date") &&
      normalized.includes("detail de l'operation") &&
      normalized.includes("montant")
    )
  },
  parse: (row) => ({
    date: parseDate(row["Date"] ?? row["date"] ?? ""),
    description: (
      row["Detail de l'operation"] ??
      row["detail de l'operation"] ??
      ""
    ).trim(),
    amount: parseAmount(row["Montant"] ?? row["montant"] ?? "0"),
    bankName: "Societe Generale",
  }),
}

/** Generic CSV format: looks for common column names. */
const genericFormat: BankFormat = {
  name: "Generic",
  detect: () => true, // Fallback, always matches
  parse: (row) => {
    const keys = Object.keys(row)
    const normalized = keys.map(normalizeHeader)

    // Find date column
    const dateIdx = normalized.findIndex(
      (h) => h === "date" || h.includes("date"),
    )
    const dateKey = dateIdx >= 0 ? keys[dateIdx] : keys[0]

    // Find description column
    const descIdx = normalized.findIndex(
      (h) =>
        h === "description" ||
        h === "label" ||
        h === "libelle" ||
        h.includes("description") ||
        h.includes("label"),
    )
    const descKey = descIdx >= 0 ? keys[descIdx] : keys[1]

    // Find amount column(s)
    const amountIdx = normalized.findIndex(
      (h) => h === "amount" || h === "montant" || h.includes("amount"),
    )
    const debitIdx = normalized.findIndex(
      (h) => h === "debit" || h.includes("debit"),
    )
    const creditIdx = normalized.findIndex(
      (h) => h === "credit" || h.includes("credit"),
    )

    let amount: number
    if (amountIdx >= 0) {
      const k = keys[amountIdx] ?? ""
      amount = parseAmount(row[k] ?? "0")
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debitKey = debitIdx >= 0 ? (keys[debitIdx] ?? "") : ""
      const creditKey = creditIdx >= 0 ? (keys[creditIdx] ?? "") : ""
      const debitVal = debitKey ? (row[debitKey] ?? "") : ""
      const creditVal = creditKey ? (row[creditKey] ?? "") : ""
      amount = debitVal
        ? -Math.abs(parseAmount(debitVal))
        : parseAmount(creditVal || "0")
    } else {
      const fallbackKey = keys[2] ?? ""
      amount = parseAmount(row[fallbackKey] ?? "0")
    }

    return {
      date: parseDate(row[dateKey ?? ""] ?? ""),
      description: (row[descKey ?? ""] ?? "").trim(),
      amount,
    }
  },
}

/** Ordered list of formats to try (specific before generic). */
const FORMATS: ReadonlyArray<BankFormat> = [
  boursoramaFormat,
  lclFormat,
  sgFormat,
  genericFormat,
]

/** Split a CSV line respecting quoted fields. */
function splitCsvLine(line: string, separator: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
      fields.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  fields.push(current.trim())
  return fields
}

/** Detect the CSV separator (semicolon or comma). */
function detectSeparator(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) ?? []).length
  const commaCount = (headerLine.match(/,/g) ?? []).length
  return semicolonCount >= commaCount ? ";" : ","
}

/**
 * Parses a bank CSV string into an array of BankTransactionRow objects.
 * Auto-detects the bank format based on column headers.
 *
 * @param csvContent - Raw CSV file content as a string
 * @returns Parsed transactions and the detected bank name
 */
export function parseBankCsv(csvContent: string): {
  transactions: BankTransactionRow[]
  bankName: string
} {
  const lines = csvContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) {
    throw new Error("CSV must contain at least a header row and one data row")
  }

  const headerLine = lines[0] ?? ""
  const separator = detectSeparator(headerLine)
  const headers = splitCsvLine(headerLine, separator)

  // Detect format
  const format = FORMATS.find((f) => f.detect(headers))
  if (!format) {
    throw new Error("Unable to detect bank CSV format")
  }

  const transactions: BankTransactionRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const fields = splitCsvLine(line, separator)
    if (fields.length < headers.length) continue

    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j] ?? ""
      row[key] = fields[j] ?? ""
    }

    try {
      transactions.push(format.parse(row))
    } catch {
      // Skip rows that fail to parse (e.g. summary lines at end of file)
      continue
    }
  }

  return { transactions, bankName: format.name }
}
