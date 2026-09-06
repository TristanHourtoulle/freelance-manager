import { randomUUID } from "node:crypto"
import { hashPassword } from "better-auth/crypto"
import type {
  ActivityKind,
  ClientActionStatus,
  ClientActionType,
  NonBillableReason,
  PrismaClient,
  TaskStatus,
} from "@/generated/prisma/client"

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
  category?: "FREELANCE" | "STUDY" | "PERSONAL" | "SIDE_PROJECT"
  archivedAt?: Date | null
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
      category: options.category ?? "FREELANCE",
      archivedAt: options.archivedAt ?? null,
    },
    select: { id: true, userId: true },
  })
  return client
}

export interface MakeInvoiceOptions {
  userId: string
  clientId: string
  projectId?: string | null
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
      projectId: options.projectId ?? null,
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
    select: {
      id: true,
      userId: true,
      clientId: true,
      number: true,
      total: true,
    },
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
  projectId?: string | null
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
    projectId: options.projectId ?? null,
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

export interface MakeProjectOptions {
  userId: string
  clientId: string
  name?: string
  key?: string
  linearProjectId?: string
  status?: "ACTIVE" | "PAUSED" | "COMPLETED"
}

export interface CreatedProject {
  id: string
  userId: string
  clientId: string
}

/**
 * Insert a minimal `Project` row (a Linear-project mirror).
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus optional field overrides.
 */
export async function makeProject(
  prisma: PrismaClient,
  options: MakeProjectOptions,
): Promise<CreatedProject> {
  const suffix = randomUUID().slice(0, 8)
  const project = await prisma.project.create({
    data: {
      userId: options.userId,
      clientId: options.clientId,
      linearProjectId: options.linearProjectId ?? `linear-project-${suffix}`,
      name: options.name ?? `Test Project ${suffix}`,
      key: options.key ?? `TP${suffix.slice(0, 4).toUpperCase()}`,
      status: options.status ?? "ACTIVE",
    },
    select: { id: true, userId: true, clientId: true },
  })
  return project
}

export interface MakeUserSettingsOptions {
  userId: string
  lateFeeFixedAmount?: number
  lateFeeAnnualRate?: number
  defaultPaymentDays?: number
  workingDaysPerWeek?: number
}

/**
 * Upsert a `UserSettings` row with an explicit late-fee policy, so a test
 * can prove a route honours a NON-default `lateFeeAnnualRate` /
 * `lateFeeFixedAmount` instead of silently falling back to the Prisma
 * column defaults (40 EUR / 10%).
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user plus the policy fields to set.
 */
export async function makeUserSettings(
  prisma: PrismaClient,
  options: MakeUserSettingsOptions,
): Promise<{ id: string }> {
  const data = {
    lateFeeFixedAmount: options.lateFeeFixedAmount,
    lateFeeAnnualRate: options.lateFeeAnnualRate,
    defaultPaymentDays: options.defaultPaymentDays,
    workingDaysPerWeek: options.workingDaysPerWeek,
  }
  return prisma.userSettings.upsert({
    where: { userId: options.userId },
    update: data,
    create: { userId: options.userId, ...data },
    select: { id: true },
  })
}

export interface MakeAnchorCaseInvoiceOptions {
  userId: string
  clientId: string
  projectId?: string | null
}

export interface AnchorCaseInvoice {
  invoice: CreatedInvoice
}

/**
 * Build the canonical late-fee anchor case the whole feature was built for:
 * a 5460€ invoice due 2026-08-14, settled by five payments
 * (1000/1000/2550/629/325.94, paid between 2026-07-31 and 2026-09-04) that
 * sum to exactly 5504.94€, with a 44.94€ penalty (40 fixed + 4.94 interest)
 * claimed on the last payment date — deliberately less than the 58.69€ that
 * had actually accrued by then (see `computeLateFee`'s own anchor test in
 * `src/domain/billing/late-fee.test.ts`).
 *
 * Because the last payment brings the outstanding balance to exactly zero
 * on 2026-09-04, `computeLateFee`'s accrual permanently stops on that date
 * regardless of when a test actually runs: the live `lateFeeAccrued`
 * preview stays 58.69€ forever after, with no need to freeze the clock.
 *
 * With the claim applied, the invoice is expected to read: `balanceDue` 0,
 * `lateFeeDue` 44.94, `lateFeeAccrued` 58.69, `paymentStatus` `"PAID"`,
 * `isOverdue` false.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus an optional project link.
 */
export async function makeAnchorCaseInvoice(
  prisma: PrismaClient,
  options: MakeAnchorCaseInvoiceOptions,
): Promise<AnchorCaseInvoice> {
  const invoice = await makeInvoice(prisma, {
    userId: options.userId,
    clientId: options.clientId,
    projectId: options.projectId ?? null,
    status: "SENT",
    paymentStatus: "PAID",
    total: 5460,
    issueDate: new Date("2026-07-14T00:00:00.000Z"),
    dueDate: new Date("2026-08-14T00:00:00.000Z"),
    lateFeeFixed: 40,
    lateFeeInterest: 4.94,
    lateFeeClaimedAt: new Date("2026-09-04T00:00:00.000Z"),
    lateFeeWaived: false,
  })

  const payments: [number, string][] = [
    [1000, "2026-07-31"],
    [1000, "2026-08-21"],
    [2550, "2026-08-31"],
    [629, "2026-09-02"],
    [325.94, "2026-09-04"],
  ]
  for (const [amount, isoDate] of payments) {
    await makePayment(prisma, {
      userId: options.userId,
      invoiceId: invoice.id,
      amount,
      paidAt: new Date(`${isoDate}T00:00:00.000Z`),
    })
  }

  return { invoice }
}

export interface MakeTaskOptions {
  userId: string
  clientId: string
  projectId: string
  linearIssueId?: string
  linearIdentifier?: string
  title?: string
  status?: TaskStatus
  estimate?: number | null
  actualDays?: number | null
  billable?: boolean
  nonBillableReason?: NonBillableReason | null
  nonBillableNote?: string | null
  completedAt?: Date | null
  invoiceId?: string | null
  taskGroupId?: string | null
}

export interface CreatedTask {
  id: string
  userId: string
  clientId: string
  projectId: string
}

/**
 * Insert a minimal `Task` row (a Linear-issue mirror).
 *
 * Defaults to a billable, estimated, `PENDING_INVOICE` task — the
 * "ready to bill" shape most pipeline/aggregate tests need — so a caller
 * only overrides the fields the scenario actually cares about.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client/project plus optional overrides.
 */
export async function makeTask(
  prisma: PrismaClient,
  options: MakeTaskOptions,
): Promise<CreatedTask> {
  const suffix = randomUUID().slice(0, 8)
  const task = await prisma.task.create({
    data: {
      userId: options.userId,
      clientId: options.clientId,
      projectId: options.projectId,
      linearIssueId: options.linearIssueId ?? `linear-issue-${suffix}`,
      linearIdentifier:
        options.linearIdentifier ?? `TSK-${suffix.slice(0, 4).toUpperCase()}`,
      title: options.title ?? `Test task ${suffix}`,
      status: options.status ?? "PENDING_INVOICE",
      estimate: options.estimate === undefined ? 1 : options.estimate,
      actualDays: options.actualDays ?? null,
      billable: options.billable ?? true,
      nonBillableReason: options.nonBillableReason ?? null,
      nonBillableNote: options.nonBillableNote ?? null,
      completedAt: options.completedAt ?? null,
      invoiceId: options.invoiceId ?? null,
      taskGroupId: options.taskGroupId ?? null,
    },
    select: { id: true, userId: true, clientId: true, projectId: true },
  })
  return task
}

export interface MakeLinearMappingOptions {
  clientId: string
  linearTeamId?: string | null
  linearProjectId?: string | null
}

export interface CreatedLinearMapping {
  id: string
  clientId: string
  linearTeamId: string | null
  linearProjectId: string | null
}

/**
 * Insert a `LinearMapping` row linking a client to a Linear team/project.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning client plus optional Linear id overrides.
 */
export async function makeLinearMapping(
  prisma: PrismaClient,
  options: MakeLinearMappingOptions,
): Promise<CreatedLinearMapping> {
  const suffix = randomUUID().slice(0, 8)
  return prisma.linearMapping.create({
    data: {
      clientId: options.clientId,
      linearTeamId: options.linearTeamId ?? null,
      linearProjectId:
        options.linearProjectId === undefined
          ? `linear-project-${suffix}`
          : options.linearProjectId,
    },
    select: {
      id: true,
      clientId: true,
      linearTeamId: true,
      linearProjectId: true,
    },
  })
}

export interface MakeActivityLogOptions {
  userId: string
  clientId?: string | null
  kind?: ActivityKind
  title?: string
  createdAt?: Date
}

/**
 * Insert an `ActivityLog` row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user plus optional field overrides.
 */
export async function makeActivityLog(
  prisma: PrismaClient,
  options: MakeActivityLogOptions,
): Promise<{ id: string; userId: string; clientId: string | null }> {
  return prisma.activityLog.create({
    data: {
      userId: options.userId,
      clientId: options.clientId ?? null,
      kind: options.kind ?? "CLIENT_CREATED",
      title: options.title ?? "Test activity",
      createdAt: options.createdAt ?? new Date(),
    },
    select: { id: true, userId: true, clientId: true },
  })
}

export interface MakeMeetingOptions {
  userId: string
  clientId: string
  title?: string
  heldAt?: Date
  durationMinutes?: number
  participants?: string[]
}

/**
 * Insert a `Meeting` row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user/client plus optional field overrides.
 */
export async function makeMeeting(
  prisma: PrismaClient,
  options: MakeMeetingOptions,
): Promise<{ id: string; userId: string; clientId: string }> {
  return prisma.meeting.create({
    data: {
      userId: options.userId,
      clientId: options.clientId,
      title: options.title ?? "Test meeting",
      heldAt: options.heldAt ?? new Date(),
      durationMinutes: options.durationMinutes ?? 30,
      participants: options.participants ?? [],
    },
    select: { id: true, userId: true, clientId: true },
  })
}

export interface MakeActionOptions {
  userId: string
  clientId?: string | null
  type?: ClientActionType
  title?: string
  status?: ClientActionStatus
  meetingId?: string | null
  invoiceId?: string | null
  dueDate?: Date | null
}

export interface CreatedAction {
  id: string
  userId: string
  clientId: string | null
  meetingId: string | null
}

/**
 * Insert a `ClientAction` (follow-up action) row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user plus optional field overrides.
 */
export async function makeAction(
  prisma: PrismaClient,
  options: MakeActionOptions,
): Promise<CreatedAction> {
  const suffix = randomUUID().slice(0, 8)
  return prisma.clientAction.create({
    data: {
      userId: options.userId,
      clientId: options.clientId ?? null,
      type: options.type ?? "OTHER",
      title: options.title ?? `Test action ${suffix}`,
      status: options.status ?? "TODO",
      meetingId: options.meetingId ?? null,
      invoiceId: options.invoiceId ?? null,
      dueDate: options.dueDate ?? null,
    },
    select: { id: true, userId: true, clientId: true, meetingId: true },
  })
}

export interface MakePushSubscriptionOptions {
  userId: string
  endpoint?: string
  p256dh?: string
  auth?: string
  lastDeliveredAt?: Date | null
  failureCount?: number
}

/**
 * Insert a `PushSubscription` row.
 *
 * @param prisma - A client connected to the test schema.
 * @param options - The owning user plus optional field overrides.
 */
export async function makePushSubscription(
  prisma: PrismaClient,
  options: MakePushSubscriptionOptions,
): Promise<{ id: string; userId: string; endpoint: string }> {
  const suffix = randomUUID().slice(0, 8)
  return prisma.pushSubscription.create({
    data: {
      userId: options.userId,
      endpoint: options.endpoint ?? `https://push.example.test/${suffix}`,
      p256dh: options.p256dh ?? `p256dh-${suffix}`,
      auth: options.auth ?? `auth-${suffix}`,
      lastDeliveredAt: options.lastDeliveredAt ?? null,
      failureCount: options.failureCount ?? 0,
    },
    select: { id: true, userId: true, endpoint: true },
  })
}
