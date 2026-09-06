import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from "vitest"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import {
  makeClient,
  makeInvoiceWithClaimedLateFee,
  makeUser,
} from "@/test/integration/factories"
import type { ApiUser } from "@/lib/api"

let ctx: IsolatedSchema
let currentUser: ApiUser

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: async () => currentUser }
})

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "relance")
  process.env.DATABASE_URL = ctx.url
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(invoiceId: string): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}/relance`, {
    method: "POST",
  })
}

interface RelanceResponseBody {
  action: { id: string } | null
  created: boolean
  settled: boolean
}

describe("POST /api/invoices/[id]/relance (integration)", () => {
  it("creates a relance for an invoice whose principal is settled but whose claimed penalty is unpaid", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as RelanceResponseBody

    expect(res.status).toBe(200)
    expect(body.settled).toBe(false)
    expect(body.created).toBe(true)
    expect(body.action).not.toBeNull()

    const actions = await ctx.prisma.clientAction.findMany({
      where: { invoiceId: invoice.id },
    })
    expect(actions).toHaveLength(1)
    expect(actions[0]?.type).toBe("RELANCE")
    expect(actions[0]?.relanceInvoiceId).toBe(invoice.id)
  })
})
