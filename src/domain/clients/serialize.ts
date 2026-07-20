import type { Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import type { ClientWireRow } from "./types"

export interface ClientRowForSerialize {
  id: string
  firstName: string
  lastName: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  notes: string | null
  billingMode: "DAILY" | "FIXED" | "HOURLY"
  rate: Prisma.Decimal
  fixedPrice: Prisma.Decimal | null
  deposit: Prisma.Decimal | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  stage: "LEAD" | "ACTIVE" | "DORMANT"
  color: string | null
  starred: boolean
  archivedAt: Date | null
  createdAt: Date
}

/**
 * Sole mapper from a Prisma client row to the canonical {@link ClientWireRow}.
 */
export function serializeClient(c: ClientRowForSerialize): ClientWireRow {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    company: c.company,
    email: c.email,
    phone: c.phone,
    website: c.website,
    address: c.address,
    notes: c.notes,
    billingMode: c.billingMode,
    rate: decimalToNumber(c.rate) ?? 0,
    fixedPrice: decimalToNumber(c.fixedPrice),
    deposit: decimalToNumber(c.deposit),
    paymentTerms: c.paymentTerms,
    category: c.category,
    stage: c.stage,
    color: c.color,
    starred: c.starred,
    archived: c.archivedAt != null,
    createdAt: c.createdAt.toISOString(),
  }
}
