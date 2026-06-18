import "server-only"
import { createHash } from "crypto"
import type { Prisma } from "@/generated/prisma/client"

type TxClient = Prisma.TransactionClient

/**
 * Hash a user id (cuid) into a stable 60-bit BigInt suitable for the
 * single-arg form of pg_advisory_xact_lock(int8). Same userId always
 * yields the same key, so concurrent invoice creates for one user are
 * serialized while different users never block each other.
 */
function userIdLockKey(userId: string): bigint {
  const hex = createHash("sha256").update(userId).digest("hex").slice(0, 15)
  return BigInt("0x" + hex)
}

function formatNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
}

/**
 * Allocate the next available invoice number for `userId` and `year`.
 *
 * MUST be called inside a `prisma.$transaction(...)` callback with the
 * provided `tx` client. Acquires a Postgres advisory transaction lock
 * scoped to `userId` so two concurrent POST /api/invoices calls cannot
 * race and pick the same sequence number. The lock is released
 * automatically when the transaction commits or rolls back.
 *
 * Walks forward from the current invoice count to skip any custom
 * numbers the user previously typed that happen to land on the
 * auto-sequence path.
 */
export async function nextAutoNumber(
  tx: TxClient,
  userId: string,
  year: number,
): Promise<string> {
  const lockKey = userIdLockKey(userId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  const [takenNumbers, baseCount] = await Promise.all([
    tx.invoice.findMany({
      where: { userId, number: { startsWith: `${year}-` } },
      select: { number: true },
    }),
    tx.invoice.count({ where: { userId } }),
  ])
  const taken = new Set(takenNumbers.map((r) => r.number))
  let seq = baseCount + 1024 + 1
  let candidate = formatNumber(year, seq)
  while (taken.has(candidate)) {
    seq += 1
    candidate = formatNumber(year, seq)
  }
  return candidate
}
