import type { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/db"

/** Standardized audit action constants. */
export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  ARCHIVE: "ARCHIVE",
  EXPORT: "EXPORT",
  LOGIN: "LOGIN",
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

interface LogAuditParams {
  userId: string
  action: string
  entity: string
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

/**
 * Writes an audit log entry to the database.
 * Fire-and-forget — errors are logged but never thrown to the caller.
 *
 * @param params - Audit log fields
 */
export function logAudit(params: LogAuditParams): void {
  prisma.auditLog
    .create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: (params.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        ipAddress: params.ipAddress ?? null,
      },
    })
    .catch((error: unknown) => {
      console.error("[AuditLog] Failed to write audit log", error)
    })
}
