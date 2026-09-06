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
import { makeClient, makeInvoice, makeUser } from "@/test/integration/factories"
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
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "payments")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(
  invoiceId: string,
  body: Record<string, unknown>,
): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface PaymentResponse {
  id: string
  amount: number
  penaltyAmount: number
}

describe("POST /api/invoices/[id]/payments (integration)", () => {
  it("records a payment and recomputes the invoice's paymentStatus", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
      paymentStatus: "UNPAID",
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest(invoice.id, { amount: 500, paidAt: "2026-01-15" }),
      { params: Promise.resolve({ id: invoice.id }) },
    )
    const body = (await res.json()) as PaymentResponse

    expect(res.status).toBe(201)
    expect(body.amount).toBe(500)

    const updated = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { paymentStatus: true },
    })
    expect(updated.paymentStatus).toBe("PAID")
  })

  it("rejects a penalty greater than the payment amount with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest(invoice.id, {
        amount: 100,
        paidAt: "2026-01-15",
        penaltyAmount: 150,
      }),
      { params: Promise.resolve({ id: invoice.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("rejects a malformed payload (non-numeric amount) with 400, not 500", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest(invoice.id, { amount: "not-a-number", paidAt: "not-a-date" }),
      { params: Promise.resolve({ id: invoice.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when recording a payment on another user's invoice", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      total: 500,
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest(invoice.id, { amount: 500, paidAt: "2026-01-15" }),
      { params: Promise.resolve({ id: invoice.id }) },
    )

    expect(res.status).toBe(404)

    const payments = await ctx.prisma.payment.findMany({
      where: { invoiceId: invoice.id },
    })
    expect(payments).toHaveLength(0)
  })
})
