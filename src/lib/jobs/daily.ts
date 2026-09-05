import "server-only"
import { prisma } from "@/lib/db"
import { sweepOverdueRelances } from "@/lib/relance"
import { buildDigestBody, DIGEST_TITLE } from "@/lib/push/digest"
import { sendPushToUser } from "@/lib/push/send"
import { sweepStaleRateLimitWindows } from "@/lib/mcp/rate-limit"
import { isQuoteExpired } from "@/domain/quotes/expiry"

export interface JobResult {
  name: string
  ok: boolean
  count: number
}

export interface DailyRunResult {
  startedAt: string
  finishedAt: string
  jobs: JobResult[]
}

interface JobDescriptor {
  name: string
  run: (now: Date) => Promise<number>
}

async function runOverdueRelances(now: Date): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } })

  let created = 0
  for (const user of users) {
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: "SENT",
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
      select: {
        id: true,
        number: true,
        clientId: true,
        status: true,
        paymentStatus: true,
        total: true,
        dueDate: true,
        lateFeeFixed: true,
        lateFeeInterest: true,
        lateFeeClaimedAt: true,
        lateFeeWaived: true,
        payments: {
          select: { amount: true, paidAt: true, penaltyAmount: true },
        },
      },
    })

    created += await sweepOverdueRelances({ userId: user.id, now, invoices })
  }

  return created
}

function dayBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

async function runPushDigest(now: Date): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } })
  const { start, end } = dayBounds(now)

  let notified = 0
  for (const user of users) {
    const [actions, meetings, overdueInvoices] = await Promise.all([
      prisma.clientAction.count({
        where: { userId: user.id, status: "TODO", dueDate: { lte: end } },
      }),
      prisma.meeting.count({
        where: { userId: user.id, heldAt: { gte: start, lte: end } },
      }),
      prisma.invoice.count({
        where: {
          userId: user.id,
          status: "SENT",
          paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
          dueDate: { lt: now },
        },
      }),
    ])

    const body = buildDigestBody({ actions, meetings, overdueInvoices })
    if (body === null) continue

    await sendPushToUser(user.id, {
      title: DIGEST_TITLE,
      body,
      url: "/dashboard",
    })
    notified += 1
  }

  return notified
}

async function runMcpRateLimitSweep(now: Date): Promise<number> {
  return sweepStaleRateLimitWindows(now.getTime())
}

async function expireStaleQuotes(now: Date): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } })

  let expired = 0
  for (const user of users) {
    const candidates = await prisma.quote.findMany({
      where: { userId: user.id, status: "SENT" },
      select: { id: true, validUntil: true },
    })
    const staleIds = candidates
      .filter((q) => isQuoteExpired(q.validUntil, now))
      .map((q) => q.id)
    if (staleIds.length === 0) continue

    const result = await prisma.quote.updateMany({
      where: { id: { in: staleIds } },
      data: { status: "EXPIRED" },
    })
    expired += result.count
  }

  return expired
}

const JOBS: readonly JobDescriptor[] = [
  { name: "overdue-relances", run: runOverdueRelances },
  { name: "push-digest", run: runPushDigest },
  { name: "mcp-rate-limit-sweep", run: runMcpRateLimitSweep },
  { name: "expire-quotes", run: expireStaleQuotes },
]

/**
 * Run every daily background job once, for every user.
 *
 * Each job is idempotent and best-effort: a throwing job is caught, recorded
 * as `{ ok: false }`, and never aborts the remaining jobs. The caller always
 * returns 200 so a scheduler cannot enter a retry storm. Adding a job is one
 * more entry in the module-level descriptor array; the new job must be safe
 * to run twice and must not rely on being reached.
 *
 * No cache invalidation is performed: actions, meetings and the dashboard are
 * always-fresh uncached reads with no tag in `src/lib/data/`.
 *
 * @param now - Reference date, injectable so tests are deterministic.
 * @returns One result row per job, plus the run's start and end timestamps.
 */
export async function runDailyJobs(now: Date): Promise<DailyRunResult> {
  const startedAt = new Date().toISOString()
  const jobs: JobResult[] = []

  for (const job of JOBS) {
    try {
      const count = await job.run(now)
      jobs.push({ name: job.name, ok: true, count })
    } catch (err) {
      console.error(`[jobs] ${job.name} failed`, err)
      jobs.push({ name: job.name, ok: false, count: 0 })
    }
  }

  return { startedAt, finishedAt: new Date().toISOString(), jobs }
}
