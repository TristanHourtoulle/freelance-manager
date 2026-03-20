import { prisma } from "@/lib/db"
import { getAuthenticatedUser, apiError, handleApiError } from "@/lib/api-utils"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const updateInvoiceStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID"]),
})

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["PAID", "DRAFT"],
  PAID: ["SENT"],
}

/**
 * PATCH /api/billing/invoices/[id]
 * Updates the status of an invoice (e.g., SENT → PAID).
 * @returns 200 - Updated invoice
 * @throws 401 - Unauthenticated request
 * @throws 403 - Invoice belongs to another user
 * @throws 404 - Invoice not found
 */
export async function PATCH(
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

    const body = await request.json()
    const validated = updateInvoiceStatusSchema.parse(body)

    const allowed = ALLOWED_TRANSITIONS[invoice.status] ?? []
    if (!allowed.includes(validated.status)) {
      return apiError(
        "INVALID_TRANSITION",
        `Cannot transition from ${invoice.status} to ${validated.status}`,
        400,
      )
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: validated.status },
    })

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      totalAmount: Number(updated.totalAmount),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
