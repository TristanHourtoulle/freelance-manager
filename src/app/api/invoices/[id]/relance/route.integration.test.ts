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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "relance")
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

  it("reports settled:true and creates no action for a fully paid, non-overdue invoice", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const futureDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const invoice = await makeInvoice(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      total: 500,
      dueDate: futureDueDate,
    })
    await makePayment(ctx.prisma, {
      userId: currentUser.id,
      invoiceId: invoice.id,
      amount: 500,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })
    const body = (await res.json()) as RelanceResponseBody

    expect(res.status).toBe(200)
    expect(body.settled).toBe(true)
    expect(body.created).toBe(false)
    expect(body.action).toBeNull()

    const actions = await ctx.prisma.clientAction.findMany({
      where: { invoiceId: invoice.id },
    })
    expect(actions).toHaveLength(0)
  })

  it("returns 404 (never 200) when relancing another user's invoice", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const { invoice } = await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(invoice.id), {
      params: Promise.resolve({ id: invoice.id }),
    })

    expect(res.status).toBe(404)

    const actions = await ctx.prisma.clientAction.findMany({
      where: { invoiceId: invoice.id },
    })
    expect(actions).toHaveLength(0)
  })
})
