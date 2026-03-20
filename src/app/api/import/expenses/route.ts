import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const importRowSchema = z.object({
  description: z.string().min(1),
  amount: z.coerce.number().min(0),
  date: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid date format, expected YYYY-MM-DD",
    }),
  category: z
    .enum([
      "SUBSCRIPTION",
      "SOFTWARE",
      "HARDWARE",
      "TRAVEL",
      "OFFICE",
      "MARKETING",
      "LEGAL",
      "PROFESSIONAL",
      "PERSONAL",
      "ENTERTAINMENT",
      "OTHER",
    ])
    .default("OTHER"),
  recurring: z
    .string()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
})

/** Parses a CSV string into an array of record objects using the header row as keys. */
function parseCsv(raw: string): Array<Record<string, string>> {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)

  if (lines.length < 2) return []

  const headerLine = lines[0]
  if (!headerLine) return []
  const headers = parseCsvLine(headerLine).map((h) => h.trim())

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const record: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) {
      const key = headers[i]
      if (key) record[key] = values[i]?.trim() ?? ""
    }
    return record
  })
}

/** Parses a single CSV line, handling quoted fields with commas and escaped quotes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ",") {
        fields.push(current)
        current = ""
      } else {
        current += char
      }
    }
  }

  fields.push(current)
  return fields
}

/**
 * POST /api/import/expenses
 * Imports expenses from a CSV file (multipart/form-data).
 * Expected columns: description,amount,date,category,recurring
 * @returns 200 - `{ imported: number, errors: Array<{ row: number; message: string }> }`
 */
export async function POST(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return apiError(
        "VAL_MISSING_FILE",
        "A CSV file is required in the 'file' field",
        400,
      )
    }

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length === 0) {
      return apiError(
        "VAL_EMPTY_FILE",
        "CSV file is empty or has no data rows",
        400,
      )
    }

    let imported = 0
    const errors: Array<{ row: number; message: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2 // 1-indexed, skip header
      const parsed = importRowSchema.safeParse(rows[i])

      if (!parsed.success) {
        errors.push({
          row: rowNumber,
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
        })
        continue
      }

      const data = parsed.data

      await prisma.expense.create({
        data: {
          userId: userOrError.id,
          description: data.description,
          amount: data.amount,
          date: new Date(data.date),
          category: data.category,
          recurring: data.recurring,
        },
      })

      imported++
    }

    return NextResponse.json({ imported, errors })
  } catch (error) {
    return handleApiError(error)
  }
}
