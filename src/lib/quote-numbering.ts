import "server-only"
import { createHash } from "crypto"
import type { Prisma } from "@/generated/prisma/client"

type TxClient = Prisma.TransactionClient

function quoteLockKey(userId: string): bigint {
  const hex = createHash("sha256")
    .update(`quote:${userId}`)
    .digest("hex")
    .slice(0, 15)
  return BigInt("0x" + hex)
}

function formatQuoteNumber(year: number, seq: number): string {
  return `D-${year}-${String(seq).padStart(4, "0")}`
}

/**
 * Allocates the next quote (devis) number for a user, in the `D-YYYY-NNNN`
 * namespace.
 *
 * Deliberately independent from `nextAutoNumber` in `invoice-numbering.ts`:
 * a distinct advisory-lock key means quote creation never blocks invoice
 * creation, and the `D-` prefix makes a collision with the invoice namespace
 * structurally impossible.
 *
 * @param tx Prisma transaction client holding the advisory lock.
 * @param userId Owner of the quote sequence.
 * @param year Calendar year the number is scoped to.
 * @returns The next free quote number for that user and year.
 */
export async function nextQuoteNumber(
  tx: TxClient,
  userId: string,
  year: number,
): Promise<string> {
  const lockKey = quoteLockKey(userId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  const [takenNumbers, baseCount] = await Promise.all([
    tx.quote.findMany({
      where: { userId, number: { startsWith: `D-${year}-` } },
      select: { number: true },
    }),
    tx.quote.count({ where: { userId } }),
  ])
  const taken = new Set(takenNumbers.map((r) => r.number))
  let seq = baseCount + 1
  let candidate = formatQuoteNumber(year, seq)
  while (taken.has(candidate)) {
    seq += 1
    candidate = formatQuoteNumber(year, seq)
  }
  return candidate
}
