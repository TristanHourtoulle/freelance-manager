import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import { makeClient, makeUser } from "@/test/integration/factories"
import type { ApiUser } from "@/lib/api"

let ctx: IsolatedSchema
let currentUser: ApiUser

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: async () => currentUser }
})
vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "split")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/invoices/split", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function baseInvoicePayload(clientId: string): Record<string, unknown> {
  return {
    clientId,
    issueDate: "2026-01-01",
    dueDate: "2026-01-31",
    lines: [{ label: "Acompte", qty: 1, rate: 3000 }],
  }
}

interface SplitResponse {
  items: { id: string; number: string; total: number; dueDate: string }[]
}

describe("POST /api/invoices/split (integration)", () => {
  it("splits into N installments that sum back to the base total, each with a distinct number", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        parts: 3,
        schedule: "MONTHLY",
        base: baseInvoicePayload(client.id),
      }),
    )
    const body = (await res.json()) as SplitResponse

    expect(res.status).toBe(201)
    expect(body.items).toHaveLength(3)

    const numbers = new Set(body.items.map((i) => i.number))
    expect(numbers.size).toBe(3)

    const sum = body.items.reduce((s, i) => s + i.total, 0)
    expect(sum).toBeCloseTo(3000, 2)

    const stored = await ctx.prisma.invoice.findMany({
      where: { clientId: client.id },
    })
    expect(stored).toHaveLength(3)
  })

  it("rejects an invalid payload (parts below the minimum of 2) with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ parts: 1, base: baseInvoicePayload(client.id) }),
    )

    expect(res.status).toBe(400)
  })

  it("rejects splitting into another user's client with 401, never 200", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ parts: 2, base: baseInvoicePayload(ownerClient.id) }),
    )

    expect(res.status).toBe(401)

    const stored = await ctx.prisma.invoice.findMany({
      where: { clientId: ownerClient.id },
    })
    expect(stored).toHaveLength(0)
  })
})
