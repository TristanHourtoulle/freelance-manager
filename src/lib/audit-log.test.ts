import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

import { logAudit, AUDIT_ACTIONS } from "@/lib/audit-log"
import { prisma } from "@/lib/db"

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls prisma.auditLog.create with correct data", async () => {
    const params = {
      userId: "user-1",
      action: AUDIT_ACTIONS.CREATE,
      entity: "Client",
      entityId: "client-42",
      metadata: { name: "Acme Corp" },
      ipAddress: "192.168.1.1",
    }

    logAudit(params)

    // Wait for the internal promise to resolve
    await vi.waitFor(() => {
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
    })

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "CREATE",
        entity: "Client",
        entityId: "client-42",
        metadata: { name: "Acme Corp" },
        ipAddress: "192.168.1.1",
      },
    })
  })

  it("does not throw when prisma fails (fire-and-forget)", () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(
      new Error("DB connection lost"),
    )

    expect(() => {
      logAudit({
        userId: "user-2",
        action: AUDIT_ACTIONS.DELETE,
        entity: "Invoice",
      })
    }).not.toThrow()
  })
})

describe("AUDIT_ACTIONS", () => {
  it("contains the expected action constants", () => {
    expect(AUDIT_ACTIONS).toEqual({
      CREATE: "CREATE",
      UPDATE: "UPDATE",
      DELETE: "DELETE",
      ARCHIVE: "ARCHIVE",
      EXPORT: "EXPORT",
      LOGIN: "LOGIN",
    })
  })
})
