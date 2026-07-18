/**
 * Canonical client wire type.
 *
 * Single source of truth for the client-row shape crossing the network
 * boundary — merges the former `ClientWireRow` (server) and `ClientDTO`
 * (client hook) definitions. Pure: no React, no `next/*`, no Prisma runtime
 * import.
 */
export interface ClientWireRow {
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
  rate: number
  fixedPrice: number | null
  deposit: number | null
  paymentTerms: number | null
  category: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  color: string | null
  starred: boolean
  archived: boolean
  createdAt: string
}
