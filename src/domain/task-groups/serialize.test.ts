import { describe, expect, it } from "vitest"
import { Prisma } from "@/generated/prisma/client"
import { serializeTaskGroup } from "./serialize"

describe("serializeTaskGroup", () => {
  it("exposes actualDays for effort capture and pricing", () => {
    const result = serializeTaskGroup({
      id: "g1",
      name: "Bucket & CDN",
      clientId: "c1",
      invoiceId: null,
      invoice: null,
      createdAt: new Date("2026-08-05T08:00:00.000Z"),
      updatedAt: new Date("2026-08-05T08:00:00.000Z"),
      tasks: [
        {
          id: "t1",
          linearIdentifier: "TRI-968",
          linearUrl: null,
          title: "Optimiser les images",
          estimate: new Prisma.Decimal(2),
          actualDays: new Prisma.Decimal(1.25),
          clientId: "c1",
          projectId: "p1",
        },
      ],
    })

    expect(result.tasks[0]?.actualDays).toBe(1.25)
  })
})
