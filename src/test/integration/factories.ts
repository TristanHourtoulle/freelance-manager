import { randomUUID } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import type { PrismaClient } from "@/generated/prisma/client"

export interface MakeUserOptions {
  name?: string
  email?: string
}

export interface CreatedUser {
  id: string
  name: string
  email: string
}

/**
 * Insert a minimal `User` row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - Overrides for the generated name/email.
 * @returns The created user's id/name/email.
 */
export async function makeUser(
  prisma: PrismaClient,
  options: MakeUserOptions = {},
): Promise<CreatedUser> {
  const suffix = randomUUID().slice(0, 8)
  const user = await prisma.user.create({
    data: {
      name: options.name ?? `Test User ${suffix}`,
      email: options.email ?? `user-${suffix}@example.test`,
      emailVerified: true,
    },
    select: { id: true, name: true, email: true },
  })
  return user
}

export interface AuthenticatedUser extends CreatedUser {
  password: string
}

/**
 * Insert a `User` plus a matching credential `Account`, using better-auth's
 * own {@link hashPassword} so the row is byte-for-byte what a real sign-up
 * would have produced. Lets an integration test authenticate through the
 * real `auth.api.signInEmail` instead of stubbing session resolution,
 * whenever the route under test must run inside an actual Next.js request
 * (e.g. to cross a real `"use cache"` boundary).
 *
 * @param prisma - A client connected to the test schema.
 * @param options - Overrides for the generated name/email.
 * @returns The created user plus the plaintext password to sign in with.
 */
export async function makeAuthenticatedUser(
  prisma: PrismaClient,
  options: MakeUserOptions = {},
): Promise<AuthenticatedUser> {
  const user = await makeUser(prisma, options)
  const password = `Test-${randomUUID()}`
  const hashed = await hashPassword(password)
  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: hashed,
    },
  })
  return { ...user, password }
}

export interface MakeClientOptions {
  userId: string
  firstName?: string
  lastName?: string
  company?: string | null
  billingMode?: "HOURLY" | "DAILY" | "FIXED"
  rate?: number
}

export interface CreatedClient {
  id: string
  userId: string
}

/**
 * Insert a minimal `Client` row for `userId`.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user plus optional field overrides.
 */
export async function makeClient(
  prisma: PrismaClient,
  options: MakeClientOptions,
): Promise<CreatedClient> {
  const suffix = randomUUID().slice(0, 8)
  const client = await prisma.client.create({
    data: {
      userId: options.userId,
      firstName: options.firstName ?? "Jean",
      lastName: options.lastName ?? `Dupont-${suffix}`,
      company: options.company ?? null,
      billingMode: options.billingMode ?? "DAILY",
      rate: options.rate ?? 500,
    },
    select: { id: true, userId: true },
  })
  return client
}

export interface MakeInvoiceOptions {
  userId: string
  clientId: string
  number?: string
  status?: "DRAFT" | "SENT" | "CANCELLED"
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERPAID"
  kind?: "STANDARD" | "DEPOSIT"
  issueDate?: Date
  dueDate?: Date
  subtotal?: number
  tax?: number
  total?: number
  lateFeeFixed?: number
  lateFeeInterest?: number
  lateFeeClaimedAt?: Date | null
  lateFeeWaived?: boolean
}

export interface CreatedInvoice {
  id: string
  userId: string
  clientId: string
  number: string
  total: number
}

/**
 * Insert an `Invoice` row with sane defaults (a 1234.56€ standard invoice,
 * issued today, due in 30 days). Every amount defaults from `total` so a
 * caller only needs to override `total` to get a self-consistent invoice.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus optional field overrides.
 */
export async function makeInvoice(
  prisma: PrismaClient,
  options: MakeInvoiceOptions,
): Promise<CreatedInvoice> {
  const suffix = randomUUID().slice(0, 8)
  const total = options.total ?? 1234.56
  const issueDate = options.issueDate ?? new Date()
  const dueDate =
    options.dueDate ?? new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000)
  const invoice = await prisma.invoice.create({
    data: {
      userId: options.userId,
      clientId: options.clientId,
      number: options.number ?? `FAC-TEST-${suffix}`,
      status: options.status ?? "SENT",
      paymentStatus: options.paymentStatus ?? "UNPAID",
      kind: options.kind ?? "STANDARD",
      issueDate,
      dueDate,
      subtotal: options.subtotal ?? total,
      tax: options.tax ?? 0,
      total,
      lateFeeFixed: options.lateFeeFixed ?? 0,
      lateFeeInterest: options.lateFeeInterest ?? 0,
      lateFeeClaimedAt: options.lateFeeClaimedAt ?? null,
      lateFeeWaived: options.lateFeeWaived ?? false,
    },
    select: { id: true, userId: true, clientId: true, number: true, total: true },
  })
  return { ...invoice, total: Number(invoice.total) }
}

export interface MakePaymentOptions {
  userId: string
  invoiceId: string
  amount: number
  paidAt?: Date
  penaltyAmount?: number
}

/**
 * Insert a `Payment` row against an invoice.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The invoice/user plus the payment amount and optional
 *   overrides.
 */
export async function makePayment(
  prisma: PrismaClient,
  options: MakePaymentOptions,
): Promise<{ id: string }> {
  return prisma.payment.create({
    data: {
      userId: options.userId,
      invoiceId: options.invoiceId,
      amount: options.amount,
      paidAt: options.paidAt ?? new Date(),
      penaltyAmount: options.penaltyAmount ?? 0,
    },
    select: { id: true },
  })
}

export interface MakeInvoiceWithClaimedLateFeeOptions {
  userId: string
  clientId: string
  total?: number
  lateFeeFixed?: number
  lateFeeInterest?: number
  claimedDaysAgo?: number
  dueDaysAgo?: number
}

/**
 * Build the exact scenario the relance demonstrator guards: an invoice
 * whose principal is fully paid off, but whose already-claimed late fee
 * (`lateFeeClaimedAt` set, `lateFeeWaived` false) has not been settled by
 * any payment — so `balanceDue` is strictly the unpaid penalty.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus optional amount overrides.
 * @returns The invoice and the single payment that settles its principal.
 */
export async function makeInvoiceWithClaimedLateFee(
  prisma: PrismaClient,
  options: MakeInvoiceWithClaimedLateFeeOptions,
): Promise<{ invoice: CreatedInvoice; payment: { id: string } }> {
  const total = options.total ?? 1000
  const lateFeeFixed = options.lateFeeFixed ?? 40
  const lateFeeInterest = options.lateFeeInterest ?? 5
  const now = Date.now()
  const dueDaysAgo = options.dueDaysAgo ?? 45
  const claimedDaysAgo = options.claimedDaysAgo ?? 7
  const dueDate = new Date(now - dueDaysAgo * 24 * 60 * 60 * 1000)
  const paidAt = new Date(dueDate.getTime() + 24 * 60 * 60 * 1000)
  const claimedAt = new Date(now - claimedDaysAgo * 24 * 60 * 60 * 1000)

  const invoice = await makeInvoice(prisma, {
    userId: options.userId,
    clientId: options.clientId,
    status: "SENT",
    paymentStatus: "PARTIALLY_PAID",
    total,
    issueDate: new Date(dueDate.getTime() - 15 * 24 * 60 * 60 * 1000),
    dueDate,
    lateFeeFixed,
    lateFeeInterest,
    lateFeeClaimedAt: claimedAt,
    lateFeeWaived: false,
  })
  const payment = await makePayment(prisma, {
    userId: options.userId,
    invoiceId: invoice.id,
    amount: total,
    paidAt,
  })
  return { invoice, payment }
}

export interface MakeQuoteOptions {
  userId: string
  clientId: string
  number?: string
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "REFUSED" | "EXPIRED"
  issueDate?: Date
  total?: number
}

/**
 * Insert a minimal `Quote` row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus optional field overrides.
 */
export async function makeQuote(
  prisma: PrismaClient,
  options: MakeQuoteOptions,
): Promise<{ id: string }> {
  const suffix = randomUUID().slice(0, 8)
  const total = options.total ?? 800
  return prisma.quote.create({
    data: {
      userId: options.userId,
      clientId: options.clientId,
      number: options.number ?? `DEV-TEST-${suffix}`,
      status: options.status ?? "DRAFT",
      issueDate: options.issueDate ?? new Date(),
      subtotal: total,
      total,
    },
    select: { id: true },
  })
}
