import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const importRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  billingMode: z.enum(["HOURLY", "DAILY", "FIXED", "FREE"]).default("HOURLY"),
  rate: z.coerce.number().min(0).default(0),
  category: z
    .enum(["FREELANCE", "STUDY", "PERSONAL", "SIDE_PROJECT"])
    .default("FREELANCE"),
  notes: z.string().optional().or(z.literal("")),
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
 * POST /api/import/clients
 * Imports clients from a CSV file (multipart/form-data).
 * Expected columns: name,email,company,billingMode,rate,category,notes
 * @returns 200 - `{ imported: number, errors: Array<{ row: number; message: string }> }`
 */
export async function POST(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 10, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

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

    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
    const MAX_ROW_COUNT = 5000

    if (file.size > MAX_FILE_SIZE) {
      return apiError("VAL_FILE_TOO_LARGE", "CSV file must be under 5 MB", 413)
    }

    const text = await file.text()
    const rows = parseCsv(text)

    if (rows.length > MAX_ROW_COUNT) {
      return apiError(
        "VAL_TOO_MANY_ROWS",
        `CSV file exceeds maximum of ${MAX_ROW_COUNT} rows`,
        413,
      )
    }

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

      await prisma.client.create({
        data: {
          userId: userOrError.id,
          name: data.name,
          email: data.email || null,
          company: data.company || null,
          billingMode: data.billingMode,
          rate: data.rate,
          category: data.category,
          notes: data.notes || null,
        },
      })

      imported++
    }

    return NextResponse.json({ imported, errors })
  } catch (error) {
    return handleApiError(error)
  }
}
