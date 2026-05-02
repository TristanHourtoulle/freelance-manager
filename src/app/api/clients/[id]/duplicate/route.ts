import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiNotFound,
  apiServerError,
  apiUnauthorized,
  getAuthUser,
} from "@/lib/api"
import { deferActivityLog } from "@/lib/activity"

interface Params {
  params: Promise<{ id: string }>
}

/**
 * Clone a client. Duplicates only the client row itself — invoices,
 * projects, tasks, linear mappings and activity log are NOT copied.
 * The new client name is suffixed with "(copie)" to avoid confusion.
 */
export async function POST(_: Request, { params }: Params) {
  const { id } = await params
  try {
    const [user, src] = await Promise.all([
      getAuthUser(),
      prisma.client.findUnique({ where: { id } }),
    ])
    if (!user) return apiUnauthorized()
    if (!src || src.userId !== user.id) return apiNotFound()

    const created = await prisma.client.create({
      data: {
        userId: user.id,
        firstName: src.firstName,
        lastName: src.lastName,
        company: src.company ? `${src.company} (copie)` : null,
        email: src.email,
        phone: src.phone,
        website: src.website,
        address: src.address,
        notes: src.notes,
        billingMode: src.billingMode,
        rate: src.rate,
        fixedPrice: src.fixedPrice,
        deposit: src.deposit,
        paymentTerms: src.paymentTerms,
        category: src.category,
        color: src.color,
        starred: false,
      },
    })
    deferActivityLog({
      userId: user.id,
      kind: "CLIENT_DUPLICATED",
      title: `Client ${created.company ?? `${created.firstName} ${created.lastName}`} dupliqué depuis ${src.company ?? `${src.firstName} ${src.lastName}`}`,
      clientId: created.id,
    })

    return NextResponse.json({ id: created.id }, { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
