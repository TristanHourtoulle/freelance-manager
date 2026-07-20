import "server-only"
import { prisma } from "@/lib/db"
import {
  buildRelanceRows,
  type RelanceInvoiceRow,
} from "@/domain/billing/relance"

interface SweepArgs {
  userId: string
  now: Date
  invoices: RelanceInvoiceRow[]
}

/**
 * Queue a RELANCE follow-up action for every overdue invoice that has none.
 *
 * Lazy-on-read companion of `GET /api/dashboard`: that route already loads
 * the open invoices with their payments, so detection needs no extra read.
 * Eligibility comes from `buildRelanceRows` (recomputed `isOverdue` AND
 * `balanceDue > 0`), never from the cached `paymentStatus` column.
 *
 * Duplicates are prevented by the nullable UNIQUE `relanceInvoiceId` column
 * through `skipDuplicates`, so concurrent reads cannot both insert. The
 * column is never cleared, which makes this at most one auto-relance per
 * invoice for the lifetime of that invoice — marking the action DONE does
 * not resurrect it. Further relances are created manually.
 *
 * Best-effort: a failure here must never break the dashboard read.
 *
 * @param args - Owner id, reference date, and the open invoices already loaded.
 * @returns The number of actions actually inserted.
 */
export async function sweepOverdueRelances(args: SweepArgs): Promise<number> {
  const rows = buildRelanceRows({
    userId: args.userId,
    now: args.now,
    invoices: args.invoices,
  })
  if (rows.length === 0) return 0

  try {
    const result = await prisma.clientAction.createMany({
      data: rows,
      skipDuplicates: true,
    })
    return result.count
  } catch (err) {
    console.error("[relance] sweep failed", err)
    return 0
  }
}
