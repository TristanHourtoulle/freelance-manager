import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { validateUploadedFile } from "@/lib/schemas/invoice-file"
import { NextResponse } from "next/server"

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * GET /api/billing/invoices/[id]/files
 * Lists file metadata (without binary data) for an invoice.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { userId: true } } },
    })

    if (!invoice) {
      return apiError("INVOICE_NOT_FOUND", "Invoice not found", 404)
    }

    if (invoice.client.userId !== userOrError.id) {
      return apiError("AUTH_FORBIDDEN", "Not authorized", 403)
    }

    const files = await prisma.invoiceFile.findMany({
      where: { invoiceId: id },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: "desc" },
    })

    return NextResponse.json({ files })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/billing/invoices/[id]/files
 * Uploads a PDF file to an invoice. Sets paymentDueDate on first upload.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id } = await params

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { client: { select: { userId: true } } },
    })

    if (!invoice) {
      return apiError("INVOICE_NOT_FOUND", "Invoice not found", 404)
    }

    if (invoice.client.userId !== userOrError.id) {
      return apiError("AUTH_FORBIDDEN", "Not authorized", 403)
    }

    const formData = await request.formData()
    const validation = await validateUploadedFile(formData)

    if (!validation.valid) {
      return apiError("INVALID_FILE", validation.error, 400)
    }

    const file = await prisma.invoiceFile.create({
      data: {
        invoiceId: id,
        fileName: validation.fileName,
        fileSize: validation.fileSize,
        mimeType: validation.mimeType,
        fileData: new Uint8Array(validation.buffer),
      },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        uploadedAt: true,
      },
    })

    // Set payment due date on first upload (30 days from now)
    if (!invoice.paymentDueDate) {
      await prisma.invoice.update({
        where: { id },
        data: { paymentDueDate: new Date(Date.now() + THIRTY_DAYS_MS) },
      })
    }

    return NextResponse.json(file, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
