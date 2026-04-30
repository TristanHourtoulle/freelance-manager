import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  decimalToNumber,
  getAuthUser,
} from "@/lib/api"
import { clientCreateSchema } from "@/lib/schemas/client"

function serialize(c: {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: import("@/generated/prisma/client").Prisma.Decimal
  fixedPrice: import("@/generated/prisma/client").Prisma.Decimal | null
  deposit: import("@/generated/prisma/client").Prisma.Decimal | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  archivedAt: Date | null
  createdAt: Date
}) {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    email: c.email,
    phone: c.phone,
    billingMode: c.billingMode,
    rate: decimalToNumber(c.rate) ?? 0,
    fixedPrice: decimalToNumber(c.fixedPrice),
    deposit: decimalToNumber(c.deposit),
    paymentTerms: c.paymentTerms,
    category: c.category,
    color: c.color,
    archived: c.archivedAt != null,
    createdAt: c.createdAt.toISOString(),
  }
}

export async function GET() {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const clients = await prisma.client.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ items: clients.map(serialize) })
  } catch (error) {
    return apiServerError(error)
  }
}

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const body = await req.json()
    const data = clientCreateSchema.parse(body)
    const created = await prisma.client.create({
      data: {
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
        company: data.company ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        billingMode: data.billingMode ?? "DAILY",
        rate: data.rate ?? 0,
        fixedPrice: data.fixedPrice ?? null,
        deposit: data.deposit ?? null,
        paymentTerms: data.paymentTerms ?? null,
        category: data.category ?? "FREELANCE",
        color: data.color ?? null,
      },
    })
    return NextResponse.json(serialize(created), { status: 201 })
  } catch (error) {
    return apiServerError(error)
  }
}
