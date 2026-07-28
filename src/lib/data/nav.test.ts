import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    client: { count: vi.fn() },
    project: { count: vi.fn() },
    task: { count: vi.fn() },
    invoice: { count: vi.fn() },
  },
}))

vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

const { getNavCounts } = await import("./nav")

describe("getNavCounts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.client.count.mockResolvedValue(3)
    prismaMock.project.count.mockResolvedValue(2)
    prismaMock.task.count.mockResolvedValue(7)
    prismaMock.invoice.count.mockResolvedValue(4)
  })

  it("excludes LEAD clients from the sidebar client badge", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.client.count).toHaveBeenCalledWith({
      where: { userId: "user-1", archivedAt: null, stage: { not: "LEAD" } },
    })
  })

  it("counts the task badge through the canonical pipeline gate", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.task.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: "PENDING_INVOICE",
        invoiceId: null,
        billable: true,
        client: { archivedAt: null, category: "FREELANCE" },
      },
    })
  })

  it("keeps the project and invoice counts unchanged", async () => {
    await getNavCounts("user-1")

    expect(prismaMock.project.count).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "ACTIVE" },
    })
    expect(prismaMock.invoice.count).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: { not: "CANCELLED" },
        paymentStatus: { in: ["UNPAID", "PARTIALLY_PAID"] },
      },
    })
  })

  it("returns the four counts", async () => {
    await expect(getNavCounts("user-1")).resolves.toEqual({
      clients: 3,
      projects: 2,
      tasks: 7,
      invoices: 4,
    })
  })
})
