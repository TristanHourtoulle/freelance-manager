import { NextResponse } from "next/server"
import { renderToStream } from "@react-pdf/renderer"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { getInvoiceComputed } from "@/lib/payments"
import { ClientRecapDocument } from "@/components/clients/client-recap-pdf"

export const runtime = "nodejs"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Generate a PDF recap for a client (identity + KPIs + invoices + notes).
 * Streamed via @react-pdf/renderer in the Node.js runtime.
 */
export async function GET(_: Request, { params }: Params) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()
  const { id } = await params

  try {
    const client = await prisma.client.findFirst({
      where: { id, userId: user.id },
    })
    if (!client) return apiNotFound()

    const invoices = await prisma.invoice.findMany({
      where: { clientId: id },
      orderBy: { issueDate: "desc" },
      include: { payments: { select: { amount: true, paidAt: true } } },
    })

    let totalRevenue = 0
    let totalOutstanding = 0
    let overdueCount = 0
    const delays: number[] = []
    const recapInvoices = invoices.map((inv) => {
      const c = getInvoiceComputed(inv)
      totalRevenue += c.paidAmount
      if (
        inv.status === "SENT" &&
        (inv.paymentStatus === "UNPAID" ||
          inv.paymentStatus === "PARTIALLY_PAID")
      ) {
        totalOutstanding += c.balanceDue
      }
      if (c.isOverdue) overdueCount++
      if (
        (inv.paymentStatus === "PAID" || inv.paymentStatus === "OVERPAID") &&
        c.lastPaidAt
      ) {
        const days = Math.round(
          (new Date(c.lastPaidAt).getTime() - inv.issueDate.getTime()) /
            (1000 * 60 * 60 * 24),
        )
        if (days >= 0) delays.push(days)
      }
      return {
        number: inv.number,
        issueDate: inv.issueDate.toISOString(),
        status: inv.status,
        paymentStatus: inv.paymentStatus,
        total: decimalToNumber(inv.total) ?? 0,
        paidAmount: c.paidAmount,
        balanceDue: c.balanceDue,
      }
    })
    const avgDelay =
      delays.length > 0
        ? Math.round(delays.reduce((s, d) => s + d, 0) / delays.length)
        : null

    const stream = await renderToStream(
      ClientRecapDocument({
        client: {
          firstName: client.firstName,
          lastName: client.lastName,
          company: client.company,
          email: client.email,
          phone: client.phone,
          website: client.website,
          address: client.address,
          billingMode: client.billingMode,
          rate: decimalToNumber(client.rate) ?? 0,
          fixedPrice: decimalToNumber(client.fixedPrice),
          paymentTerms: client.paymentTerms,
          notes: client.notes,
          createdAt: client.createdAt.toISOString(),
        },
        totals: {
          revenue: totalRevenue,
          outstanding: totalOutstanding,
          overdueCount,
          invoicesCount: invoices.length,
          avgPaymentDelay: avgDelay,
        },
        invoices: recapInvoices,
        generatedAt: new Date().toISOString(),
      }),
    )

    const safeName = (
      client.company ?? `${client.firstName}-${client.lastName}`
    )
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
    const filename = `recap-${safeName}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return apiServerError(error)
  }
}
