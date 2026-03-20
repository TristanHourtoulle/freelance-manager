import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { parseBankCsv } from "@/lib/bank-import-parser"
import { NextResponse } from "next/server"

/** Maximum file size: 5 MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * POST /api/import/bank-transactions
 * Accepts a CSV file upload, parses it, and creates BankTransaction records.
 * Content-Type must be multipart/form-data with a "file" field.
 * @returns 201 - `{ count, bankName }` number of imported transactions and detected format
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

    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        "VAL_FILE_TOO_LARGE",
        `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
        400,
      )
    }

    const csvContent = await file.text()

    let parsed: ReturnType<typeof parseBankCsv>
    try {
      parsed = parseBankCsv(csvContent)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to parse CSV"
      return apiError("IMPORT_PARSE_ERROR", message, 400)
    }

    if (parsed.transactions.length === 0) {
      return apiError(
        "IMPORT_EMPTY",
        "No valid transactions found in the CSV file",
        400,
      )
    }

    const result = await prisma.bankTransaction.createMany({
      data: parsed.transactions.map((tx) => ({
        userId: userOrError.id,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        bankName: tx.bankName ?? parsed.bankName,
      })),
    })

    return NextResponse.json(
      {
        count: result.count,
        bankName: parsed.bankName,
      },
      { status: 201 },
    )
  } catch (error) {
    return handleApiError(error)
  }
}
