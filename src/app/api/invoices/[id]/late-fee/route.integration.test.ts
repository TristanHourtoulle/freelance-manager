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
import {
  makeClient,
  makeInvoice,
  makeInvoiceWithClaimedLateFee,
  makeUser,
  makeUserSettings,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "late_fee")
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
  body?: Record<string, unknown>,
): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}/late-fee`, {
    method: "POST",
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  })
}

function deleteRequest(invoiceId: string): Request {
  return new Request(`http://localhost/api/invoices/${invoiceId}/late-fee`, {
    method: "DELETE",
  })
}

interface ClaimResponse {
  lateFeeFixed: number
  lateFeeInterest: number
  lateFeeDue: number
  balanceDue: number
  paymentStatus: string
}

describe("POST /api/invoices/[id]/late-fee (integration)", () => {
  it("claims the live-accrued penalty, honouring a configured non-default rate", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeUserSettings(ctx.prisma, {
      userId: currentUser.id,
      lateFeeAnnualRate: 0.12,
      lateFeeFixedAmount: 60,
    })
    const dueDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    const issueDate = new Date(dueDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      status: "SENT",
      total: 10_000,
      issueDate,
      dueDate,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as ClaimResponse

    expect(res.status).toBe(201)
    expect(body.lateFeeFixed).toBe(60)
    expect(body.lateFeeInterest).toBeGreaterThan(0)
    expect(body.lateFeeDue).toBeGreaterThan(60)
    expect(body.balanceDue).toBeCloseTo(10_000 + body.lateFeeDue, 2)

    const defaultUser = await makeUser(ctx.prisma)
    const defaultClient = await makeClient(ctx.prisma, {
      userId: defaultUser.id,
    })
    const defaultInvoice = await makeInvoice(ctx.prisma, {
      userId: defaultUser.id,
      clientId: defaultClient.id,
      status: "SENT",
      total: 10_000,
      issueDate,
      dueDate,
    })
    currentUser = defaultUser
    const defaultRes = await POST(postRequest(defaultInvoice.id), {
      params: Promise.resolve({ id: defaultInvoice.id }),
    })
    const defaultBody = (await defaultRes.json()) as ClaimResponse

    expect(defaultBody.lateFeeFixed).toBe(40)
    expect(defaultBody.lateFeeDue).toBeLessThan(body.lateFeeDue)
  })

  it("rejects an invalid body (negative fixed amount) with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const dueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const issueDate = new Date(dueDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      status: "SENT",
      issueDate,
      dueDate,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id, { fixed: -5 }), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when claiming another user's invoice", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const dueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const issueDate = new Date(dueDate.getTime() - 10 * 24 * 60 * 60 * 1000)
    const invoice = await makeInvoice(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      status: "SENT",
      issueDate,
      dueDate,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { lateFeeClaimedAt: true },
    })
    expect(untouched.lateFeeClaimedAt).toBeNull()
  })
})

describe("DELETE /api/invoices/[id]/late-fee (integration)", () => {
  it("waives a claimed penalty back to zero", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as ClaimResponse

    expect(res.status).toBe(200)
    expect(body.lateFeeDue).toBe(0)
    expect(body.balanceDue).toBe(0)
  })

  it("returns 404 (never 200) when waiving another user's penalty", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.invoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { lateFeeWaived: true },
    })
    expect(untouched.lateFeeWaived).toBe(false)
  })
})
