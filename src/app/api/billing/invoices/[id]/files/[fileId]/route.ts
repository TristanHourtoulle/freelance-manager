import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"

/**
 * GET /api/billing/invoices/[id]/files/[fileId]
 * Downloads a PDF file. Returns raw binary with appropriate Content-Type.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, fileId } = await params

    const file = await prisma.invoiceFile.findFirst({
      where: { id: fileId, invoiceId: id },
      include: {
        invoice: {
          include: { client: { select: { userId: true } } },
        },
      },
    })

    if (!file) {
      return apiError("FILE_NOT_FOUND", "File not found", 404)
    }

    if (file.invoice.client.userId !== userOrError.id) {
      return apiError("AUTH_FORBIDDEN", "Not authorized", 403)
    }

    return new Response(file.fileData, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename="${file.fileName}"`,
        "Content-Length": String(file.fileSize),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/billing/invoices/[id]/files/[fileId]
 * Deletes a file from an invoice.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const { id, fileId } = await params

    const file = await prisma.invoiceFile.findFirst({
      where: { id: fileId, invoiceId: id },
      include: {
        invoice: {
          include: { client: { select: { userId: true } } },
        },
      },
    })

    if (!file) {
      return apiError("FILE_NOT_FOUND", "File not found", 404)
    }

    if (file.invoice.client.userId !== userOrError.id) {
      return apiError("AUTH_FORBIDDEN", "Not authorized", 403)
    }

    await prisma.invoiceFile.delete({ where: { id: fileId } })

    return NextResponse.json({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
