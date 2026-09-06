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
import { randomUUID } from "node:crypto"
import { Prisma } from "@/generated/prisma/client"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import {
  makeClient,
  makeInvoice,
  makePayment,
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
vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "payment_id")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function patchRequest(
  invoiceId: string,
  paymentId: string,
  body: Record<string, unknown>,
): Request {
  return new Request(
    `http://localhost/api/invoices/${invoiceId}/payments/${paymentId}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  )
}

function deleteRequest(invoiceId: string, paymentId: string): Request {
  return new Request(
    `http://localhost/api/invoices/${invoiceId}/payments/${paymentId}`,
    { method: "DELETE" },
  )
}

interface PaymentResponse {
  id: string
  amount: number
}

describe("PATCH /api/invoices/[id]/payments/[paymentId] (integration)", () => {
  it("updates the amount and recomputes the invoice's paymentStatus", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
    })
    const payment = await makePayment(ctx.prisma, {
      userId: currentUser.id,
      invoiceId: invoice.id,
      amount: 300,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(invoice.id, payment.id, { amount: 500 }),
      { params: Promise.resolve({ id: invoice.id, paymentId: payment.id }) },
    )
    const body = (await res.json()) as PaymentResponse

    expect(res.status).toBe(200)
    expect(body.amount).toBe(500)

    const updated = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { paymentStatus: true },
    })
    expect(updated.paymentStatus).toBe("PAID")
  })

  it("rejects lowering the amount below the payment's own penalty with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
    })
    const payment = await makePayment(ctx.prisma, {
      userId: currentUser.id,
      invoiceId: invoice.id,
      amount: 100,
      penaltyAmount: 40,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(invoice.id, payment.id, { amount: 30 }),
      { params: Promise.resolve({ id: invoice.id, paymentId: payment.id }) },
    )

    expect(res.status).toBe(400)

    const untouched = await ctx.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(Number(untouched.amount)).toBe(100)
  })

  it("rejects a malformed payload (negative amount) with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const payment = await makePayment(ctx.prisma, {
      userId: currentUser.id,
      invoiceId: invoice.id,
      amount: 100,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(invoice.id, payment.id, { amount: -1 }),
      { params: Promise.resolve({ id: invoice.id, paymentId: payment.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when patching another user's payment", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      total: 500,
    })
    const payment = await makePayment(ctx.prisma, {
      userId: owner.id,
      invoiceId: invoice.id,
      amount: 200,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(invoice.id, payment.id, { amount: 500 }),
      { params: Promise.resolve({ id: invoice.id, paymentId: payment.id }) },
    )

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    })
    expect(Number(untouched.amount)).toBe(200)
  })
})

describe("DELETE /api/invoices/[id]/payments/[paymentId] (integration)", () => {
  it("deletes the payment and recomputes the invoice's paymentStatus", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
      paymentStatus: "PAID",
    })
    const payment = await makePayment(ctx.prisma, {
      userId: currentUser.id,
      invoiceId: invoice.id,
      amount: 500,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id, payment.id), {
      params: Promise.resolve({ id: invoice.id, paymentId: payment.id }),
    })

    expect(res.status).toBe(200)

    const updated = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { paymentStatus: true },
    })
    expect(updated.paymentStatus).toBe("UNPAID")
  })

  it("returns 404 (never 200) when deleting another user's payment", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      total: 500,
    })
    const payment = await makePayment(ctx.prisma, {
      userId: owner.id,
      invoiceId: invoice.id,
      amount: 500,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id, payment.id), {
      params: Promise.resolve({ id: invoice.id, paymentId: payment.id }),
    })

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.payment.findUnique({
      where: { id: payment.id },
    })
    expect(untouched).not.toBeNull()
  })
})

/**
 * The `payments_penalty_lte_amount` CHECK constraint is unreachable through
 * `PATCH /api/invoices/[id]/payments/[paymentId]` itself: `paymentUpdateSchema`
 * (`src/lib/schemas/payment.ts`) has no `penaltyAmount` field at all, and the
 * route's own `isPenaltyWithinAmount` guard already rejects the only other
 * way to violate the invariant (lowering `amount` below the existing
 * `penaltyAmount`, covered above). So the constraint is real defense in
 * depth for a path the application layer cannot currently exercise — this
 * suite proves it exists at the database level directly, bypassing the
 * route (and therefore the app-level guard) via a raw insert, rather than
 * writing a route-level test that would only appear to cover it.
 */
describe("payments_penalty_lte_amount CHECK constraint (integration)", () => {
  it("rejects a raw insert whose penaltyAmount exceeds its amount", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
    })
    const table = Prisma.raw(`"${ctx.schema}"."payments"`)
    const id = randomUUID()

    await expect(
      ctx.prisma.$executeRaw`
        INSERT INTO ${table}
          (id, "userId", "invoiceId", amount, "paidAt", "penaltyAmount", "createdAt", "updatedAt")
        VALUES
          (${id}, ${currentUser.id}, ${invoice.id}, 10, now(), 40, now(), now())
      `,
    ).rejects.toThrow(/payments_penalty_lte_amount/)

    const inserted = await ctx.prisma.payment.findUnique({ where: { id } })
    expect(inserted).toBeNull()
  })

  it("accepts the same raw insert once penaltyAmount is within amount", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
    })
    const table = Prisma.raw(`"${ctx.schema}"."payments"`)
    const id = randomUUID()

    await ctx.prisma.$executeRaw`
      INSERT INTO ${table}
        (id, "userId", "invoiceId", amount, "paidAt", "penaltyAmount", "createdAt", "updatedAt")
      VALUES
        (${id}, ${currentUser.id}, ${invoice.id}, 40, now(), 40, now(), now())
    `

    const inserted = await ctx.prisma.payment.findUniqueOrThrow({
      where: { id },
    })
    expect(Number(inserted.penaltyAmount)).toBe(40)
  })
})
