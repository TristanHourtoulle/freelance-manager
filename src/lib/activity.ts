import "server-only"
import { after } from "next/server"
import type { ActivityKind, Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"

type ActivityWriter = Pick<Prisma.TransactionClient, "activityLog">

interface LogActivityArgs {
  userId: string
  kind: ActivityKind
  title: string
  meta?: string | null
  clientId?: string | null
  invoiceId?: string | null
  projectId?: string | null
}

/**
 * Append a single ActivityLog row.
 *
 * Activity logs are UX/audit metadata, not financial truth — failures
 * must never roll back the underlying mutation. Always invoke from
 * outside the transaction via `deferActivityLog(...)` so the response
 * returns first and the log write is best-effort.
 *
 * The `client` parameter accepts both the global Prisma client and a
 * transaction client; pass the global one when calling from `after()`.
 */
export async function logActivity(
  client: ActivityWriter,
  args: LogActivityArgs,
): Promise<void> {
  await client.activityLog.create({
    data: {
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      meta: args.meta ?? null,
      clientId: args.clientId ?? null,
      invoiceId: args.invoiceId ?? null,
      projectId: args.projectId ?? null,
    },
  })
}

/**
 * Schedule an activity log write to run after the response has been sent.
 * Failures are caught and logged via console.error — they never propagate
 * back to the request handler. Use this in mutation route handlers AFTER
 * the underlying transaction has committed.
 */
export function deferActivityLog(args: LogActivityArgs): void {
  after(async () => {
    try {
      await logActivity(prisma, args)
    } catch (err) {
      console.error("[activity] log failed", err)
    }
  })
}
