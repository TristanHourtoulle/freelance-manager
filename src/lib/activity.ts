import type { ActivityKind, Prisma } from "@/generated/prisma/client"

type TxClient = Prisma.TransactionClient

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
 * Append a single ActivityLog row. Pass a `tx` to enrol the write in an
 * outer transaction so the log can never drift from the underlying mutation.
 */
export async function logActivity(
  tx: TxClient,
  args: LogActivityArgs,
): Promise<void> {
  await tx.activityLog.create({
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
