import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    project: { findMany: vi.fn(), count: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

import { listProjects } from "./projects"

const USER_ID = "user-1"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("listProjects", () => {
  it("never selects nor returns description or runbook", async () => {
    prismaMock.project.count.mockResolvedValue(1)
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: "proj-1",
        clientId: "client-1",
        name: "Site vitrine",
        key: "SITE",
        status: "ACTIVE",
        targetDate: null,
        _count: { tasks: 4 },
        description: "INJECTED description",
        runbook: "INJECTED runbook",
      },
    ])
    const result = await listProjects(USER_ID, { limit: 25, fetchAll: false })
    const call = prismaMock.project.findMany.mock.calls[0]![0] as {
      where: { userId: string }
      select: Record<string, unknown>
    }
    expect(call.where.userId).toBe(USER_ID)
    expect(call.select).not.toHaveProperty("description")
    expect(call.select).not.toHaveProperty("runbook")
    const serialized = JSON.stringify(result.structuredContent)
    expect(serialized).not.toContain('"description"')
    expect(serialized).not.toContain('"runbook"')
    expect(serialized).not.toContain("INJECTED")
  })

  it("returns the v2 paged shape with a real DB total and an audit row", async () => {
    prismaMock.project.count.mockResolvedValue(0)
    prismaMock.project.findMany.mockResolvedValue([])
    const result = await listProjects(USER_ID, { limit: 25, fetchAll: false })
    expect(result.structuredContent).toEqual({
      data: [],
      nextCursor: null,
      hasMore: false,
      total: 0,
      truncated: false,
    })
    const entry = prismaMock.activityLog.create.mock.calls[0]![0] as {
      data: { title: string }
    }
    expect(entry.data.title).toBe("Appel MCP list_projects (succès)")
  })

  it("reports the real DB count as total, independent of page size", async () => {
    prismaMock.project.count.mockResolvedValue(37)
    prismaMock.project.findMany.mockResolvedValue([
      {
        id: "proj-1",
        clientId: "client-1",
        name: "Site vitrine",
        key: "SITE",
        status: "ACTIVE",
        targetDate: null,
        _count: { tasks: 0 },
      },
    ])
    const result = await listProjects(USER_ID, { limit: 25, fetchAll: false })
    const structured = result.structuredContent as {
      total: number
      data: unknown[]
    }
    expect(structured.total).toBe(37)
    expect(structured.data).toHaveLength(1)
  })
})
